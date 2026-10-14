import { afterEach, test, expect } from "bun:test";
import { QueryClient, QueryObserver, keepPreviousData } from "@tanstack/react-query";
import { createUsersResource, normalizeUserFilters } from "../../src/features/users/resource";
import { network, flushPromises } from "../helpers/network";
const clients: QueryClient[] = [];
afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
  const net = network(); return { client, net, resource: createUsersResource(client, net.fetch) };
}
test("filters normalize without mutation and distinguish each page", () => {
  const filters = { sort: "-created_at", offset: 0, search: "", status: undefined };
  expect(normalizeUserFilters(filters)).toEqual({ sort: "-created_at", offset: 0 }); expect(filters.search).toBe("");
});
test("fresh reads share cache and explicit refresh invalidates it", async () => {
  const { client, net, resource } = setup(); const options = resource.options({ sort: "-created_at" });
  const first = client.fetchQuery(options); net.calls[0].resolve({ users: [], total: 10 }); await first;
  expect(await client.fetchQuery(options)).toEqual({ users: [], total: 10 }); expect(net.calls).toHaveLength(1);
  await resource.refresh(); expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
});
test("filter changes abort old reads, retain previous page while pending and ignore stale replies", async () => {
  const { client, net, resource } = setup();
  const observer = new QueryObserver(client, { ...resource.options({ sort: "username", search: "first" }), placeholderData: keepPreviousData });
  const unsubscribe = observer.subscribe(() => {});
  net.calls[0].resolve({ users: [{ username: "first" }], total: 1 }); await flushPromises();
  observer.setOptions({ ...resource.options({ sort: "username", search: "second" }), placeholderData: keepPreviousData });
  expect(observer.getCurrentResult().data).toMatchObject({ users: [{ username: "first" }] });
  observer.setOptions({ ...resource.options({ sort: "username", search: "third" }), placeholderData: keepPreviousData });
  expect(net.calls[1].options.signal.aborted).toBe(true);
  net.calls[1].resolve({ users: [{ username: "late" }], total: 1 });
  net.calls[2].resolve({ users: [{ username: "third" }], total: 1 }); await flushPromises();
  expect(observer.getCurrentResult().data).toMatchObject({ users: [{ username: "third" }] }); unsubscribe();
});
test("failed background refresh retains last data and allows retry", async () => {
  const { client, net, resource } = setup(); const options = resource.options({ sort: "username" });
  const first = client.fetchQuery(options); net.calls[0].resolve({ users: [], total: 7 }); await first;
  const failed = client.fetchQuery({ ...options, staleTime: 0 }); net.calls[1].reject(new Error("offline")); await expect(failed).rejects.toThrow("offline");
  expect(client.getQueryData(options.queryKey)).toEqual({ users: [], total: 7 });
  const retry = client.fetchQuery({ ...options, staleTime: 0 }); net.calls[2].resolve({ users: [], total: 8 }); await retry;
  expect(client.getQueryData(options.queryKey)).toEqual({ users: [], total: 8 });
});
test("unmount cancels read and late response cannot enter cache", async () => {
  const { client, net, resource } = setup(); const options = resource.options({ sort: "username" });
  const observer = new QueryObserver(client, options), unsubscribe = observer.subscribe(() => {});
  unsubscribe(); expect(net.calls[0].options.signal.aborted).toBe(true);
  net.calls[0].resolve({ users: [{ username: "late" }], total: 1 }); await flushPromises();
  expect(client.getQueryData(options.queryKey)).toBeUndefined();
});

test("offline reads pause and resume with a real response on reconnect", async () => {
  const { onlineManager } = await import("@tanstack/react-query");
  const { client, net, resource } = setup(); client.mount(); onlineManager.setOnline(false);
  const observer = new QueryObserver(client, resource.options({ sort: "username" })); const unsubscribe = observer.subscribe(() => {});
  try {
    expect(observer.getCurrentResult().isPaused).toBe(true); expect(net.calls).toHaveLength(0);
    onlineManager.setOnline(true); await flushPromises(); expect(net.calls).toHaveLength(1);
    net.calls[0].resolve({ users: [], total: 3 }); await flushPromises();
    expect(observer.getCurrentResult().data?.total).toBe(3);
  } finally { unsubscribe(); onlineManager.setOnline(true); client.unmount(); }
});
