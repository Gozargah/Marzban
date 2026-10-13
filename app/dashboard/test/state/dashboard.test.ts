import { describe, test, expect, mock } from "bun:test";
import { loadSource } from "../helpers/load-source";
import { makeUser, makeUserCreate } from "../helpers/fixtures";
import { network, flushPromises } from "../helpers/network";

function setup() {
  const net = network();
  const navigate = mock((_url: string, _options: unknown) => {});
  const invalidateQueries = mock(() => {});
  const { useDashboard, fetchInbounds } = loadSource<typeof import("../../src/contexts/dashboard-context")>("contexts/dashboard-context.tsx", {
    "service/http": net, "@/pages/router": { router: { navigate } },
    "@/components/dashboard/statistics": { StatisticsQueryKey: "statistics" },
    "utils/react-query": { queryClient: { invalidateQueries } },
  });
  return { net, navigate, invalidateQueries, store: useDashboard, fetchInbounds };
}
const user = makeUser();
const body = makeUserCreate();

describe("dashboard filters", () => {
  test("encodes URLs, omits default sorting/page size, and keeps zero offset in API query", async () => {
    const { store, net, navigate } = setup();
    store.getState().onFilterChange({ search: "a & b", offset: 0, status: "active" });
    const url = new URL(navigate.mock.calls[0][0] as string, "http://localhost");
    expect(url.searchParams.get("search")).toBe("a & b");
    expect(url.searchParams.has("limit")).toBe(false);
    expect(url.searchParams.has("sort")).toBe(false);
    expect(net.calls[0].options.query).toMatchObject({ offset: 0, search: "a & b", status: "active" });
    expect(net.calls[0].options.query).not.toHaveProperty("username");
    net.calls[0].resolve({ users: [], total: 0 }); await flushPromises();
  });
  test("same filters refresh without adding history entries", async () => {
    const { store, net, navigate } = setup();
    store.getState().onFilterChange({});
    expect(navigate).not.toHaveBeenCalled();
    expect(net.calls).toHaveLength(1);
    net.calls[0].resolve({ users: [], total: 0 }); await flushPromises();
  });
  test("aborted inbound response cannot update protocols", async () => {
    const { store, net, fetchInbounds } = setup();
    const controller = new AbortController();
    const reading = fetchInbounds(controller.signal);
    controller.abort(); net.calls[0].resolve({ vless: [{ tag: "late" }] }); await reading;
    expect(store.getState().inbounds.size).toBe(0);
  });
});

describe("user mutations", () => {
  test.each([
    ["createUser", "/user", "POST", true], ["editUser", "/user/alice", "PUT", false],
    ["deleteUser", "/user/alice", "DELETE", true], ["resetDataUsage", "/user/alice/reset", "POST", false],
    ["revokeSubscription", "/user/alice/revoke_sub", "POST", false],
  ] as const)("%s refreshes users only after success", async (action, url, method, invalidates) => {
    const { store, net, invalidateQueries } = setup();
    const pending = (store.getState()[action] as (value: any) => Promise<void>)(action === "createUser" || action === "editUser" ? body : user);
    expect(net.calls).toHaveLength(1);
    expect(net.calls[0]).toMatchObject({ url, options: { method } });
    if (action === "createUser" || action === "editUser") expect(net.calls[0].options.body).toEqual(body);
    net.calls[0].resolve(user); await pending;
    expect(net.calls[1].url).toBe("/users");
    expect(invalidateQueries.mock.calls.length).toBe(invalidates ? 1 : 0);
    if (action === "revokeSubscription") expect(store.getState().editingUser).toEqual(user);
    net.calls[1].resolve({ users: [], total: 0 }); await flushPromises();
  });
  test("failed save preserves draft and does not refresh or invalidate", async () => {
    const { store, net, invalidateQueries } = setup();
    store.getState().onEditingUser(user);
    const saving = store.getState().editUser(body);
    net.calls[0].reject(new Error("validation")); await expect(saving).rejects.toThrow("validation");
    expect(store.getState().editingUser).toEqual(user);
    expect(net.calls).toHaveLength(1);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
  test("reset all closes confirmation and refreshes", async () => {
    const { store, net } = setup();
    store.getState().onResetAllUsage(true);
    const pending = store.getState().resetAllUsage();
    expect(net.calls[0]).toMatchObject({ url: "/users/reset", options: { method: "POST" } });
    net.calls[0].resolve(undefined); await pending;
    expect(store.getState().isResetingAllUsage).toBe(false);
    net.calls[1].resolve({ users: [], total: 0 }); await flushPromises();
  });
  test("usage read forwards the requested range and cancellation", async () => {
    const { store, net } = setup();
    const signal = new AbortController().signal;
    const query = { start: "2026-01-01", end: "2026-01-31" };
    const reading = store.getState().fetchUserUsage(user, query, signal);
    expect(net.calls[0]).toMatchObject({ url: "/user/alice/usage", options: { method: "GET", query, signal } });
    net.calls[0].resolve(undefined); await reading;
  });
});
