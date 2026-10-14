import { test, expect } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import { localeAdapter } from "../helpers/render";

function setup() {
  const net = network();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const { adminQueryOptions } = loadSource<typeof import("../../src/utils/admin-query")>("utils/admin-query.ts", { "service/http": net });
  let routes: any[] = [];
  loadSource("pages/router.tsx", {
    ...localeAdapter,
    "react-router": { createBrowserRouter: (configured: any[]) => { routes = configured; return {}; } },
    "utils/admin-query": { adminQueryOptions }, "utils/react-query": { queryClient: client },
    "./dashboard": { Dashboard: () => null }, "./login": { Login: () => null },
  });
  return { net, routes, client, adminQueryOptions };
}

test("dashboard navigation validates access and shares fresh admin with the header", async () => {
  const { net, routes, client, adminQueryOptions } = setup();
  try {
    const pending = routes[0].loader();
    expect(net.calls[0]).toMatchObject({ url: "/admin", options: { retry: 0 } });
    expect(net.calls[0].options.signal).toBeInstanceOf(AbortSignal);
    const admin = { username: "alice", is_sudo: true, discord_webook: "", telegram_id: "" };
    net.calls[0].resolve(admin); expect(await pending).toEqual(admin);
    expect(await client.fetchQuery(adminQueryOptions)).toEqual(admin);
    expect(net.calls).toHaveLength(1);
    const secondNavigation = routes[0].loader();
    expect(net.calls).toHaveLength(2);
    net.calls[1].resolve(admin); await secondNavigation;
  } finally { client.clear(); }
});
test("access failure reaches the route error boundary without retries", async () => {
  const { net, routes, client } = setup();
  try {
    const pending = routes[0].loader();
    net.calls[0].reject(new Error("unauthorized"));
    await expect(pending).rejects.toThrow("unauthorized");
    expect(net.calls).toHaveLength(1);
    expect(routes[0].errorElement.type.name).toBe("AccessError");
    expect(routes[1].path).toBe("/login/");
  } finally { client.clear(); }
});
