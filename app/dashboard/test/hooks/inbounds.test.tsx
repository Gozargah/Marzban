import { afterEach, test, expect } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import type { ReactNode } from "react";
const clients: QueryClient[] = [];
afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; });
function setup() {
  const net = network(), client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
  const { useInbounds } = loadSource<typeof import("../../src/features/users/use-inbounds")>("features/users/use-inbounds.ts", { "service/http": net });
  return { ...renderHook(() => useInbounds(), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }), net, client };
}
test("inbound failure exposes retry and success updates protocols", async () => {
  const { net, result } = setup(); expect(result.current.loading).toBe(true);
  await act(async () => net.calls[0].reject(new Error("offline")));
  await waitFor(() => expect(result.current.failed).toBe(true));
  let pending!: Promise<void>; act(() => { pending = result.current.retry(); });
  await act(async () => { net.calls[1].resolve({ vless: [{ tag: "tcp" }] }); await pending; });
  await waitFor(() => expect(result.current.inbounds.get("vless")?.[0].tag).toBe("tcp"));
  expect(result.current.failed).toBe(false);
});
test("unmount cancels inbound reads and late data cannot enter cache", async () => {
  const { net, unmount, client } = setup(); unmount(); expect(net.calls[0].options.signal.aborted).toBe(true);
  await act(async () => net.calls[0].resolve({ vless: [{ tag: "late" }] }));
  expect(client.getQueryData(["inbounds"])).toBeUndefined();
});
