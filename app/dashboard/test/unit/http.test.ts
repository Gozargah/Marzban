import { describe, test, expect, mock } from "bun:test";
import { loadSource } from "../helpers/load-source";
import { setAuthToken } from "../../src/utils/authStorage";

describe("authenticated HTTP adapter", () => {
  function setup() {
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
    expect(transport).toHaveBeenCalledWith("/user", { ...options, timeout: 60_000, headers: {} });
    expect(options).not.toHaveProperty("headers");
  });
  test("reads the latest token per request and preserves custom headers", async () => {
    const { fetch, transport } = setup();
    setAuthToken("one");
    await fetch("/admin", { headers: { "X-Trace": "trace" } });
    const headers = new Headers(transport.mock.lastCall?.[1].headers);
    expect(headers.get("Authorization")).toBe("Bearer one");
    expect(headers.get("X-Trace")).toBe("trace");
    setAuthToken("two");
    await fetch("/admin");
    expect(new Headers(transport.mock.lastCall?.[1].headers).get("Authorization")).toBe("Bearer two");
  });
  test("propagates errors without hiding API details", async () => {
    const error = new Error("offline");
    const { fetch, transport } = setup();
    transport.mockRejectedValueOnce(error);
    await expect(fetch("/admin")).rejects.toBe(error);
  });
});
