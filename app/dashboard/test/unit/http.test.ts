import { describe, test, expect, mock } from "bun:test";
import { loadSource } from "../helpers/load-source";

describe("authenticated HTTP adapter", () => {
  function setup(includeCsrf = true) {
    document.cookie = "marzban_csrf=; Max-Age=0; path=/";
    if (includeCsrf) document.cookie = "marzban_csrf=csrf-test; path=/";
    const transport = mock(async (_url: string, _options: any) => ({ ok: true }));
    const create = mock(() => transport);
    const source = loadSource<typeof import("../../src/service/http")>("service/http.ts", {
      ofetch: { $fetch: { create } },
    });
    return { ...source, transport, create };
  }
  test("uses API base URL and forwards request/response", async () => {
    const { fetch, transport, create } = setup();
    const options = { method: "POST" as const, body: { name: "demo" }, retry: 0 };
    expect(await fetch("/user", options)).toEqual({ ok: true });
    expect(create).toHaveBeenCalledWith({ baseURL: "/api", timeout: 15_000 });
    expect(transport).toHaveBeenCalledWith("/user", {
      ...options,
      credentials: "include",
      timeout: 60_000,
      headers: { "X-CSRF-Token": "csrf-test" },
    });
    expect(options).not.toHaveProperty("headers");
  });
  test("uses cookie credentials and preserves custom headers", async () => {
    const { fetch, transport } = setup();
    await fetch("/admin", { method: "POST", headers: { "X-Trace": "trace" } });
    const headers = new Headers(transport.mock.lastCall?.[1].headers);
    expect(transport.mock.lastCall?.[1].credentials).toBe("include");
    expect(headers.get("X-Trace")).toBe("trace");
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("X-CSRF-Token")).toBe("csrf-test");
  });
  test("bootstraps a CSRF token after reload when the API cookie is cross-origin", async () => {
    const { fetch, transport } = setup(false);
    transport.mockImplementation(async (url: string) =>
      url === "/admin/session/csrf" ? { ok: true, csrf_token: "bootstrapped-token" } : { ok: true },
    );
    await fetch("/user", { method: "POST" });
    expect(transport.mock.calls.map(([url]) => url)).toEqual(["/admin/session/csrf", "/user"]);
    expect(new Headers(transport.mock.lastCall?.[1].headers).get("X-CSRF-Token")).toBe("bootstrapped-token");
  });
  test("propagates errors without hiding API details", async () => {
    const error = new Error("offline");
    const { fetch, transport } = setup();
    transport.mockRejectedValueOnce(error);
    await expect(fetch("/admin")).rejects.toBe(error);
  });

  test.each(["GET", "HEAD", "OPTIONS"] as const)(
    "safe %s requests skip CSRF and use the read timeout",
    async (method) => {
      const { fetch, transport } = setup(false);
      await fetch("/system", { method });
      expect(transport).toHaveBeenCalledTimes(1);
      expect(transport.mock.calls[0][0]).toBe("/system");
      expect(transport.mock.calls[0][1]).toMatchObject({ method, credentials: "include", timeout: 15_000 });
      expect(new Headers(transport.mock.calls[0][1].headers).has("X-CSRF-Token")).toBe(false);
    },
  );

  test.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "mutating %s requests use the write timeout",
    async (method) => {
      const { fetch, transport } = setup();
      await fetch("/user/alice", { method });
      expect(transport.mock.lastCall?.[1]).toMatchObject({ method, timeout: 60_000 });
      expect(new Headers(transport.mock.lastCall?.[1].headers).get("X-CSRF-Token")).toBe("csrf-test");
    },
  );

  test("does not bootstrap or send CSRF for session login and honors a custom timeout", async () => {
    const { fetch, transport } = setup(false);
    await fetch("/admin/session", { method: "POST", timeout: 2_000 });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe("/admin/session");
    expect(transport.mock.calls[0][1].timeout).toBe(2_000);
    expect(new Headers(transport.mock.calls[0][1].headers).has("X-CSRF-Token")).toBe(false);
  });

  test("reuses a bootstrapped CSRF token across writes until explicitly cleared", async () => {
    const { fetch, transport, setCsrfToken } = setup(false);
    transport.mockImplementation(async (url: string) =>
      url === "/admin/session/csrf" ? { ok: true, csrf_token: "bootstrapped-token" } : { ok: true },
    );
    await fetch("/user", { method: "POST" });
    await fetch("/hosts", { method: "PUT" });
    expect(transport.mock.calls.map(([url]) => url)).toEqual(["/admin/session/csrf", "/user", "/hosts"]);
    expect(new Headers(transport.mock.calls[2][1].headers).get("X-CSRF-Token")).toBe("bootstrapped-token");
    setCsrfToken(undefined);
    document.cookie = "marzban_csrf=reloaded-token; path=/";
    await fetch("/nodes", { method: "DELETE" });
    expect(new Headers(transport.mock.lastCall?.[1].headers).get("X-CSRF-Token")).toBe("reloaded-token");
  });
});
