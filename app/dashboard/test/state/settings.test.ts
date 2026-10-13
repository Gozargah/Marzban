import { describe, test, expect, mock } from "bun:test";
import { network } from "../helpers/network";
import { loadSource } from "../helpers/load-source";

describe("hosts failures", () => {
  test("read failure clears loading and preserves existing hosts", async () => {
    const net = network();
    const { useHosts } = loadSource<typeof import("../../src/contexts/hosts-context")>("contexts/hosts-context.tsx", { "service/http": net });
    const hosts = { edge: [] };
    useHosts.setState({ hosts });
    const pending = useHosts.getState().fetchHosts();
    net.calls[0].reject(new Error("offline")); await expect(pending).rejects.toThrow("offline");
    expect(useHosts.getState()).toMatchObject({ hosts, isLoading: false });
  });
  test("failed save releases pending state and preserves saved values", async () => {
    const net = network();
    const { useHosts } = loadSource<typeof import("../../src/contexts/hosts-context")>("contexts/hosts-context.tsx", { "service/http": net });
    const pending = useHosts.getState().setHosts({ edge: [] });
    expect(useHosts.getState().isPostLoading).toBe(true);
    net.calls[0].reject(new Error("offline")); await expect(pending).rejects.toThrow("offline");
    expect(useHosts.getState()).toMatchObject({ hosts: {}, isPostLoading: false });
  });
});

describe("core settings failures", () => {
  function setup() {
    const net = network();
    const fetchInbounds = mock(async () => {});
    const { useCoreSettings } = loadSource<typeof import("../../src/contexts/core-settings-context")>("contexts/core-settings-context.tsx", {
      "service/http": net, "@/contexts/dashboard-context": { fetchInbounds },
    });
    return { net, fetchInbounds, store: useCoreSettings };
  }
  test("failed parallel read aborts its sibling and releases loading", async () => {
    const { store, net } = setup();
    const pending = store.getState().fetchCoreSettings();
    net.calls[0].reject(new Error("offline")); await expect(pending).rejects.toThrow("offline");
    expect(net.calls[1].options.signal.aborted).toBe(true);
    net.calls[1].resolve({});
    expect(store.getState()).toMatchObject({ isLoading: false, config: "", version: null });
  });
  test("invalid JSON never reaches the API", async () => {
    const { store, net } = setup();
    await expect(store.getState().updateConfig("{broken")).rejects.toThrow();
    expect(net.calls).toHaveLength(0);
    expect(store.getState().isPostLoading).toBe(false);
  });
  test("failed save keeps draft and never refreshes protocols", async () => {
    const { store, net, fetchInbounds } = setup();
    store.setState({ config: '{"old":true}' });
    const pending = store.getState().updateConfig('{"new":true}');
    net.calls[0].reject(new Error("invalid config")); await expect(pending).rejects.toThrow("invalid config");
    expect(store.getState()).toMatchObject({ config: '{"old":true}', isPostLoading: false });
    expect(fetchInbounds).not.toHaveBeenCalled();
  });
  test("successful save stays successful when inbound refresh fails", async () => {
    const { store, net, fetchInbounds } = setup();
    fetchInbounds.mockRejectedValueOnce(new Error("offline"));
    const pending = store.getState().updateConfig('{"inbounds":[]}');
    net.calls[0].resolve({}); await pending;
    expect(store.getState().config).toBe(JSON.stringify({ inbounds: [] }, null, 2));
    expect(store.getState().isPostLoading).toBe(false);
  });
  test("restart uses POST and exposes failures", async () => {
    const { store, net } = setup();
    const pending = store.getState().restartCore();
    expect(net.calls[0]).toMatchObject({ url: "/core/restart", options: { method: "POST" } });
    net.calls[0].reject(new Error("offline")); await expect(pending).rejects.toThrow("offline");
  });
});
