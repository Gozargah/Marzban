import { describe, expect, test } from "bun:test";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";

function setup() {
  const net = network();
  const source = loadSource<typeof import("../../src/contexts/nodes-context")>("contexts/nodes-context.tsx", {
    "service/http": net, "./dashboard-context": { useDashboard: () => false },
  });
  return { ...source, net, state: source.useNodes.getState() };
}
const node = { name: "edge", address: "example.com", port: 62050, api_port: 62051, usage_coefficient: 1, id: 7 };

describe("node validation", () => {
  test("defaults are fresh objects with sensible connection values", () => {
    const { getNodeDefaultValues } = setup();
    expect(getNodeDefaultValues()).toMatchObject({ port: 62050, api_port: 62051, usage_coefficient: 1 });
    expect(getNodeDefaultValues()).not.toBe(getNodeDefaultValues());
  });
  test("converts numeric form inputs", () => {
    const { NodeSchema } = setup();
    expect(NodeSchema.parse({ ...node, port: "62050", api_port: "62051", usage_coefficient: "1.5" })).toMatchObject({ port: 62050, api_port: 62051, usage_coefficient: 1.5 });
  });
  test.each([{ name: "" }, { address: "" }, { port: 0 }, { api_port: -1 }, { status: "unknown" }])("rejects invalid node %j", (patch) => {
    expect(setup().NodeSchema.safeParse({ ...node, ...patch }).success).toBe(false);
  });
});

describe("node API actions", () => {
  test.each([
    ["addNode", "/node", "POST"], ["updateNode", "/node/7", "PUT"], ["reconnectNode", "/node/7/reconnect", "POST"],
  ] as const)("%s sends the expected request", async (action, url, method) => {
    const { state, net } = setup();
    const pending = state[action](node);
    expect(net.calls[0]).toMatchObject({ url, options: { method } });
    if (action !== "reconnectNode") expect(net.calls[0].options.body).toEqual(node);
    net.calls[0].resolve(node);
    expect(await pending).toEqual(node);
  });
  test("deletes the selected node", async () => {
    const { useNodes, net } = setup();
    useNodes.getState().setDeletingNode(node);
    const pending = useNodes.getState().deleteNode();
    expect(net.calls[0]).toMatchObject({ url: "/node/7", options: { method: "DELETE" } });
    net.calls[0].resolve(undefined); await pending;
    useNodes.getState().setDeletingNode(null);
    expect(useNodes.getState().deletingNode).toBeNull();
  });
  test("forwards abort signals and usage filters; exposes failures", async () => {
    const { state, net } = setup();
    const signal = new AbortController().signal;
    const reading = state.fetchNodes(signal);
    expect(net.calls[0].options).toEqual({ signal, retry: 0 });
    net.calls[0].resolve([node]); expect(await reading).toEqual([node]);
    const query = { start: "2026-01-01" };
    const usage = state.fetchNodesUsage(query, signal);
    expect(net.calls[1]).toMatchObject({ url: "/nodes/usage", options: { query, signal, retry: 0 } });
    net.calls[1].reject(new Error("offline")); await expect(usage).rejects.toThrow("offline");
  });
});
