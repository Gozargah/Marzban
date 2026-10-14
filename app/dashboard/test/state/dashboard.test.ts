import { afterEach, describe, test, expect, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import { makeUser, makeUserCreate } from "../helpers/fixtures";
import { createUsersResource } from "../../src/features/users/resource";
import { queryKeys } from "../../src/features/shared/query-keys";
const clients: QueryClient[] = [];
afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; });
function setup() {
  const net = network(), navigate = mock((_url: string, _options: unknown) => {});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
  const resource = createUsersResource(client, net.fetch);
  const { useDashboard: store } = loadSource<typeof import("../../src/contexts/dashboard-context")>("contexts/dashboard-context.tsx", {
    "service/http": net, "@/pages/router": { router: { navigate } }, "@/features/users/api": { usersResource: resource },
  });
  return { net, navigate, client, resource, store };
}
const user = makeUser(), body = makeUserCreate();
describe("dashboard URL state", () => {
  test("encodes filters, keeps API zero offset and omits default URL fields", () => {
    const { store, navigate, resource } = setup();
    store.getState().onFilterChange({ search: "a & b", offset: 0, status: "active" });
    const url = new URL(navigate.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("search")).toBe("a & b"); expect(url.searchParams.has("limit")).toBe(false); expect(url.searchParams.has("sort")).toBe(false);
    expect(resource.options(store.getState().filters).queryKey[1]).toMatchObject({ offset: 0, search: "a & b", status: "active" });
  });
  test("unchanged filters refresh cached lists without adding history", () => {
    const { store, client, resource, navigate } = setup();
    const key = resource.options(store.getState().filters).queryKey; client.setQueryData(key, { users: [], total: 0 });
    store.getState().onFilterChange({});
    expect(navigate).not.toHaveBeenCalled(); expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });
  test("UI selectors ignore unrelated dialog changes and unsubscribe", () => {
    const { store } = setup(); let changes = 0;
    const unsubscribe = store.subscribe((state) => state.filters, () => changes++);
    store.getState().onEditingHosts(true); expect(changes).toBe(0);
    store.getState().onFilterChange({ search: "alice" }, false); expect(changes).toBe(1);
    unsubscribe(); store.getState().onFilterChange({ search: "bob" }, false); expect(changes).toBe(1);
  });

});
describe("user actions", () => {
  test.each([["createUser", "/user", "POST"], ["editUser", "/user/alice", "PUT"], ["deleteUser", "/user/alice", "DELETE"], ["resetDataUsage", "/user/alice/reset", "POST"], ["revokeSubscription", "/user/alice/revoke_sub", "POST"]] as const)("%s invalidates lists and statistics after success", async (action, url, method) => {
    const { store, net, client, resource } = setup();
    const key = resource.options(store.getState().filters).queryKey;
    client.setQueryData(key, { users: [user], total: 1 }); client.setQueryData(queryKeys.statistics, {});
    const pending = (store.getState()[action] as (value: any) => Promise<void>)(action === "createUser" || action === "editUser" ? body : user);
    expect(net.calls[0]).toMatchObject({ url, options: { method, retry: 0 } });
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    net.calls[0].resolve(user); await pending;
    expect(client.getQueryState(key)?.isInvalidated).toBe(true); expect(client.getQueryState(queryKeys.statistics)?.isInvalidated).toBe(true);
    if (action === "revokeSubscription") expect(store.getState().editingUser).toEqual(user);
  });
  test("failed save retains editing selection and leaves cache fresh", async () => {
    const { store, net, client, resource } = setup();
    store.getState().onEditingUser(user); const key = resource.options(store.getState().filters).queryKey; client.setQueryData(key, { users: [user], total: 1 });
    const saving = store.getState().editUser(body); net.calls[0].reject(new Error("invalid")); await expect(saving).rejects.toThrow("invalid");
    expect(store.getState().editingUser).toEqual(user); expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  });
  test("reset all closes confirmation only after success", async () => {
    const { store, net } = setup(); store.getState().onResetAllUsage(true);
    const pending = store.getState().resetAllUsage(); expect(store.getState().isResetingAllUsage).toBe(true);
    net.calls[0].resolve({}); await pending; expect(store.getState().isResetingAllUsage).toBe(false);
  });
});
