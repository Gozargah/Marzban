import { describe, test, expect, mock } from "bun:test";
import { loadSource } from "../helpers/load-source";

describe("authenticated HTTP adapter", () => {
  function setup(includeCsrf = true) {
    document.cookie = "marzban_csrf=; Max-Age=0; path=/";
    if (includeCsrf) document.cookie = "marzban_csrf=csrf-test; path=/";
    const transport = mock(async (_url: string, _options: any) => ({ ok: true }));
    const create = mock(() => transport);
    const { fetch } = loadSource<typeof import("../../src/service/http")>("service/http.ts", {
      ofetch: { $fetch: { create } },
    });
    return { fetch, transport, create };
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
});
