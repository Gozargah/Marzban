import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "../../../..");
const fixture = resolve(import.meta.dir, "session_fixture.py");
const pythonVenv = resolve(projectRoot, ".venv", "bin", "python");
const python = process.env.PYTHON ?? (Bun.file(pythonVenv).size ? pythonVenv : "python3");
const timeout = 120_000;
const previousHead = "2b231de97dc3";
let scratch = "";
let databaseUrl = "";
let baseUrl = "";
let origin = "";
let server: ReturnType<typeof Bun.spawn> | undefined;
let serverReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
let serverInput:
  | { write(data: string): number | Promise<number>; flush(): number | void | Promise<number | void> }
  | undefined;
let outputBuffer = "";
let migrationSnapshot: any;
let migrationBefore: any;
let migrationAfterDowngrade: any;

const env = () => ({
  ...process.env,
  PYTHONPATH: projectRoot,
  SQLALCHEMY_DATABASE_URL: databaseUrl,
  DEBUG: "true",
  AUTH_COOKIE_SECURE: "true",
  AUTH_COOKIE_SAMESITE: "strict",
  JWT_ACCESS_TOKEN_EXPIRE_MINUTES: "30",
  NOTIFY_LOGIN: "false",
  SUDO_USERNAME: "",
  SUDO_PASSWORD: "",
});

function runPython(args: string[], success = true) {
  const result = Bun.spawnSync([python, ...args], {
    cwd: projectRoot,
    env: env(),
    stdout: "pipe",
    stderr: "pipe",
    timeout,
  });
  const output = `${Buffer.from(result.stdout).toString()}${Buffer.from(result.stderr).toString()}`;
  if (success && result.exitCode !== 0) {
    throw new Error(`${python} ${args.join(" ")} failed (${result.exitCode}):\n${output}`);
  }
  return { ...result, output };
}

function inspectDb() {
  const result = runPython([fixture, "inspect"]);
  const jsonLine = result.output.split(/\r?\n/).find((line) => line.trim().startsWith("{"));
  if (!jsonLine) throw new Error(`Could not read migration inspection:\n${result.output}`);
  return JSON.parse(jsonLine);
}

function hasSessionsTable() {
  const output = runPython([fixture, "has-sessions-table"]).output;
  const value = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line === "true" || line === "false");
  if (!value) throw new Error(`Could not read migration table check:\n${output}`);
  return value === "true";
}

type ApiResponse = { status: number; headers: Array<[string, string]>; body: string };
async function nextResponse(): Promise<ApiResponse> {
  if (!serverReader) throw new Error("ASGI test process is not running");
  while (!outputBuffer.includes("\n")) {
    const { value, done } = await serverReader.read();
    if (done) throw new Error(`ASGI test process exited early: ${outputBuffer}`);
    outputBuffer += new TextDecoder().decode(value);
  }
  const index = outputBuffer.indexOf("\n");
  const line = outputBuffer.slice(0, index);
  outputBuffer = outputBuffer.slice(index + 1);
  const response = JSON.parse(line) as ApiResponse & { harness_error?: string };
  if (response.harness_error) throw new Error(`ASGI harness failed: ${response.harness_error}`);
  return response;
}

function headerValues(response: ApiResponse, name: string) {
  return response.headers.filter(([key]) => key.toLowerCase() === name.toLowerCase()).map(([, value]) => value);
}

function responseJson<T>(response: ApiResponse): T {
  return JSON.parse(response.body) as T;
}

class CookieJar {
  private readonly values = new Map<string, string>();

  header() {
    return [...this.values].map(([key, value]) => `${key}=${value}`).join("; ");
  }
  get(name: string) {
    return this.values.get(name);
  }
  absorb(response: ApiResponse) {
    const lines = headerValues(response, "set-cookie");
    for (const line of lines) {
      const pair = line.split(";", 1)[0];
      const index = pair.indexOf("=");
      if (index < 0) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (!value || /max-age=0/i.test(line)) this.values.delete(name);
      else this.values.set(name, value);
    }
  }
}

async function request(path: string, options: RequestInit = {}, jar?: CookieJar, requestOrigin = origin) {
  if (!serverInput) throw new Error("ASGI test process is not running");
  const headers = Object.fromEntries(new Headers(options.headers).entries());
  headers.Origin = requestOrigin;
  if (jar?.header()) headers.Cookie = jar.header();
  const body =
    options.body instanceof URLSearchParams
      ? options.body.toString()
      : typeof options.body === "string"
        ? options.body
        : "";
  await serverInput.write(
    `${JSON.stringify({ url: `${baseUrl}${path}`, method: options.method ?? "GET", headers, body })}\n`,
  );
  await serverInput.flush();
  const response = await nextResponse();
  jar?.absorb(response);
  return response;
}

async function login(username: string, password: string) {
  const jar = new CookieJar();
  const body = new URLSearchParams({ username, password, grant_type: "password" });
  const response = await request(
    "/api/admin/session",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    jar,
  );
  return { jar, response };
}

beforeAll(async () => {
  if (!Bun.file(python).size && python !== "python3") throw new Error(`Python executable not found: ${python}`);
  scratch = mkdtempSync(resolve(tmpdir(), "marzban-session-tests-"));
  const dbFile = resolve(scratch, "security.sqlite3");
  databaseUrl = `sqlite:///${dbFile}`;

  // Prove this new migration works for an existing installation at its prior head,
  // preserves existing admin rows, and has a working downgrade/re-upgrade path.
  runPython(["-m", "alembic", "upgrade", previousHead]);
  const hasTableBefore = hasSessionsTable();
  runPython([fixture, "seed"]);
  runPython(["-m", "alembic", "upgrade", "head"]);
  migrationSnapshot = inspectDb();
  runPython(["-m", "alembic", "downgrade", previousHead]);
  migrationAfterDowngrade = { hasTable: hasSessionsTable(), snapshot: inspectDb() };
  runPython(["-m", "alembic", "upgrade", "head"]);
  migrationSnapshot = inspectDb();
  migrationBefore = { hasTableBefore };

  baseUrl = "http://testserver";
  origin = baseUrl;
  server = Bun.spawn([python, fixture, "asgi"], {
    cwd: projectRoot,
    env: env(),
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!server.stdin || typeof server.stdin === "number" || !server.stdout || typeof server.stdout === "number") {
    throw new Error("Bun did not provide piped ASGI test process streams");
  }
  serverInput = server.stdin;
  serverReader = server.stdout.getReader();
  const health = await request("/test/health");
  expect(health.status).toBe(200);
}, timeout);

afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await server.exited;
  }
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

test("admin session migration upgrades and downgrades safely from the prior release head", () => {
  expect(migrationBefore.hasTableBefore).toBe(false);
  expect(migrationAfterDowngrade.hasTable).toBe(false);
  expect(migrationAfterDowngrade.snapshot.revision).toBe(previousHead);
  expect(migrationAfterDowngrade.snapshot.admins).toEqual([
    { username: "alice", is_sudo: true },
    { username: "bob", is_sudo: false },
  ]);
  expect(migrationSnapshot.revision).toBe("31d941bdb713");
  expect(migrationSnapshot.admins).toEqual([
    { username: "alice", is_sudo: true },
    { username: "bob", is_sudo: false },
  ]);
  expect(migrationSnapshot.session_columns).toEqual(["id", "session_hash", "username", "expires_at", "created_at"]);
  expect(migrationSnapshot.session_nullable).toEqual({
    id: false,
    session_hash: false,
    username: false,
    expires_at: true,
    created_at: false,
  });
  expect(migrationSnapshot.session_indexes.map((index: any) => [index.name, Boolean(index.unique)]).sort()).toEqual([
    ["ix_admin_sessions_expires_at", false],
    ["ix_admin_sessions_session_hash", true],
    ["ix_admin_sessions_username", false],
  ]);
});

test("cookie login, token compatibility, CSRF, origin checks, logout revocation, and WebSocket auth", async () => {
  const missingAuth = await request("/api/test/protected");
  expect(missingAuth.status).toBe(401);

  const noOrigin = await request(
    "/api/admin/session",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: "alice", password: "alice-pass", grant_type: "password" }),
    },
    undefined,
    "",
  );
  expect(noOrigin.status).toBe(403);
  const hostileOrigin = await request(
    "/api/admin/session",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: "alice", password: "alice-pass", grant_type: "password" }),
    },
    undefined,
    "https://attacker.invalid",
  );
  expect(hostileOrigin.status).toBe(403);

  const wrongPassword = await login("alice", "wrong-pass");
  expect(wrongPassword.response.status).toBe(401);
  expect(wrongPassword.jar.get("marzban_session")).toBeUndefined();

  const alice = await login("alice", "alice-pass");
  expect(alice.response.status).toBe(200);
  const sessionBody = responseJson<Record<string, unknown>>(alice.response);
  expect(sessionBody).toMatchObject({ username: "alice", is_sudo: true });
  expect(sessionBody).toHaveProperty("csrf_token");
  expect(sessionBody).not.toHaveProperty("access_token");
  expect(headerValues(alice.response, "cache-control")[0]).toBe("no-store");
  const cookies = headerValues(alice.response, "set-cookie");
  const sessionCookie = cookies.find((cookie) => cookie.startsWith("marzban_session="));
  const csrfCookie = cookies.find((cookie) => cookie.startsWith("marzban_csrf="));
  expect(sessionCookie).toContain("HttpOnly");
  expect(sessionCookie).toContain("Secure");
  expect(sessionCookie).toContain("SameSite=strict");
  expect(sessionCookie).toContain("Path=/api");
  expect(sessionCookie).toContain("Max-Age=1800");
  expect(csrfCookie).not.toContain("HttpOnly");
  expect(csrfCookie).toContain("Path=/");
  const csrf = String(sessionBody.csrf_token);
  expect(csrf.length).toBeGreaterThan(32);
  const afterAliceLogin = inspectDb();
  expect(afterAliceLogin.sessions).toHaveLength(1);
  expect(afterAliceLogin.sessions[0].username).toBe("alice");
  expect(afterAliceLogin.sessions[0].session_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(alice.jar.get("marzban_session")).not.toContain(afterAliceLogin.sessions[0].session_hash);

  const admin = await request("/api/admin", {}, alice.jar);
  expect(admin.status).toBe(200);
  expect(responseJson(admin)).toMatchObject({ username: "alice", is_sudo: true });
  const csrfBootstrap = await request("/api/admin/session/csrf", {}, alice.jar);
  expect(csrfBootstrap.status).toBe(200);
  expect(responseJson(csrfBootstrap)).toEqual({ csrf_token: csrf });

  expect((await request("/api/test/mutate", { method: "POST" }, alice.jar)).status).toBe(403);
  expect(
    (await request("/api/test/mutate", { method: "POST", headers: { "X-CSRF-Token": "wrong" } }, alice.jar)).status,
  ).toBe(403);
  expect(
    (
      await request(
        "/api/test/mutate",
        { method: "POST", headers: { "X-CSRF-Token": csrf } },
        alice.jar,
        "https://attacker.invalid",
      )
    ).status,
  ).toBe(403);
  const mutation = await request("/api/test/mutate", { method: "POST", headers: { "X-CSRF-Token": csrf } }, alice.jar);
  expect(mutation.status).toBe(200);
  expect(responseJson(mutation)).toEqual({ changed_by: "alice" });
  expect((await request("/api/test/sudo", {}, alice.jar)).status).toBe(200);

  // Exercise the real core and node WebSocket auth functions through a fake socket.
  for (const kind of ["core", "node"]) {
    const validSocket = await request(`/test/socket-auth/${kind}`, { method: "POST" }, alice.jar);
    expect(responseJson(validSocket)).toEqual({ accepted: true, closed: null });
    const badOriginSocket = await request(
      `/test/socket-auth/${kind}`,
      { method: "POST" },
      alice.jar,
      "https://attacker.invalid",
    );
    expect(responseJson(badOriginSocket)).toMatchObject({ accepted: false, closed: { code: 4403 } });
    const queryTokenSocket = await request(
      `/test/socket-auth/${kind}?token=${encodeURIComponent(alice.jar.get("marzban_session")!)}`,
      { method: "POST" },
    );
    expect(responseJson(queryTokenSocket)).toMatchObject({ accepted: false, closed: { code: 4401 } });
  }

  const aliceSecondSession = await login("alice", "alice-pass");
  expect(aliceSecondSession.response.status).toBe(200);

  const bob = await login("bob", "bob-pass");
  expect(bob.response.status).toBe(200);
  expect((await request("/api/test/protected", {}, bob.jar)).status).toBe(200);
  expect((await request("/api/test/sudo", {}, bob.jar)).status).toBe(403);
  for (const kind of ["core", "node"]) {
    const nonSudoSocket = await request(`/test/socket-auth/${kind}`, { method: "POST" }, bob.jar);
    expect(responseJson(nonSudoSocket)).toMatchObject({ accepted: false, closed: { code: 4403 } });
  }

  const tokenResponse = await request("/api/admin/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "alice", password: "alice-pass", grant_type: "password" }),
  });
  expect(tokenResponse.status).toBe(200);
  const token = responseJson<{ access_token: string }>(tokenResponse).access_token;
  expect((await request("/api/test/protected", { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
  expect(
    (await request("/api/test/mutate", { method: "POST", headers: { Authorization: `Bearer ${token}` } })).status,
  ).toBe(200);

  // Logout remains possible with a stale browser that has no CSRF cookie.
  const sessionValue = alice.jar.get("marzban_session")!;
  const crossSiteLogout = await request(
    "/api/admin/session",
    {
      method: "DELETE",
      headers: { Cookie: `marzban_session=${sessionValue}` },
    },
    undefined,
    "https://attacker.invalid",
  );
  expect(crossSiteLogout.status).toBe(403);
  const logout = await request("/api/admin/session", {
    method: "DELETE",
    headers: { Cookie: `marzban_session=${sessionValue}` },
  });
  expect(logout.status).toBe(204);
  expect(
    (await request("/api/test/protected", { headers: { Cookie: `marzban_session=${sessionValue}` } })).status,
  ).toBe(401);
  expect((await request("/api/test/protected", {}, aliceSecondSession.jar)).status).toBe(200);
  for (const kind of ["core", "node"]) {
    const revokedSocket = await request(`/test/socket-auth/${kind}`, {
      method: "POST",
      headers: { Cookie: `marzban_session=${sessionValue}` },
    });
    expect(responseJson(revokedSocket)).toMatchObject({ accepted: false, closed: { code: 4401 } });
  }
  const afterLogout = inspectDb();
  expect(afterLogout.sessions).toHaveLength(2);
  expect(afterLogout.sessions.filter((session: any) => session.username === "alice")).toHaveLength(1);
});
