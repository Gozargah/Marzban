import { test, expect } from "bun:test";
import { create } from "zustand";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import { renderFrontend, localeAdapter } from "../helpers/render";

function setup() {
  const net = network();
  const dashboard = create(() => ({ isShowingNodesUsage: true, onShowingNodesUsage: () => {} }));
  const nodes = create(() => ({ fetchNodesUsage: (query: unknown, signal: AbortSignal) => net.fetch("/nodes/usage", { query, signal }) }));
  const { NodesUsage } = loadSource<typeof import("../../src/components/dashboard/nodes-usage")>("components/dashboard/nodes-usage.tsx", {
    ...localeAdapter, "@/contexts/dashboard-context": { useDashboard: dashboard }, "@/contexts/nodes-context": { useNodes: nodes },
    "@/components/theme-provider": { useTheme: () => ({ resolvedTheme: "dark" }) },
    "@/features/shared/traffic-chart": { TrafficChart: ({ usage }: any) => <output data-testid="usage-chart">{JSON.stringify({ series: usage.series, labels: usage.labels })}</output> },
  });
  return { ...renderFrontend(<NodesUsage />), net };
}

test("usage sums uplink/downlink, keeps labels and ignores superseded results", async () => {
  const { net } = setup();
  fireEvent.click(await screen.findByRole("button", { name: "1d" }));
  expect(net.calls[0].options.signal.aborted).toBe(true);
  act(() => net.calls[0].resolve({ usages: [{ node_name: "old", uplink: 1, downlink: 1 }] }));
  act(() => net.calls[1].resolve({ usages: [{ node_name: "edge", uplink: 1024, downlink: 2048 }] }));
  expect(await screen.findByTestId("usage-chart")).toHaveTextContent('{"series":[3072],"labels":["edge"]}');
});
test("failed usage can recover by selecting another range; unmount aborts requests", async () => {
  const { net, unmount } = setup();
  act(() => net.calls[0].reject(new Error("offline")));
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not load usage/i);
  fireEvent.click(screen.getByRole("button", { name: "1w" }));
  await waitFor(() => expect(net.calls).toHaveLength(2));
  unmount(); expect(net.calls[1].options.signal.aborted).toBe(true);
  net.calls[1].resolve({ usages: [] });
});
