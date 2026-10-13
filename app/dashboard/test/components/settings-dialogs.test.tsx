import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";

function hostsSetup(fail = false) {
  const onEditingHosts = mock((_open: boolean) => {});
  const dashboard = create(() => ({ isEditingHosts: true, onEditingHosts, refetchUsers: mock(() => {}) }));
  const fetchHosts = mock(async () => { if (fail) throw new Error("offline"); });
  const cancelFetch = mock(() => {});
  const hosts = create(() => ({ hosts: {}, fetchHosts, cancelFetch, setHosts: mock(async () => {}), isLoading: false, isPostLoading: false }));
  const { HostsDialog } = loadSource<typeof import("../../src/components/dashboard/hosts-dialog")>("components/dashboard/hosts-dialog.tsx", {
    ...localeAdapter, "@/contexts/dashboard-context": { useDashboard: dashboard }, "@/contexts/hosts-context": { useHosts: hosts },
  });
  return { ...renderFrontend(<HostsDialog />), fetchHosts, cancelFetch, onEditingHosts, dashboard };
}

test("empty hosts directs the user to configure inbounds and cancels read on unmount", async () => {
  const { fetchHosts, cancelFetch, onEditingHosts, dashboard, unmount } = hostsSetup();
  expect(fetchHosts).toHaveBeenCalledTimes(1);
  fireEvent.click(await screen.findByRole("button", { name: /configure inbounds/i }));
  expect(onEditingHosts).toHaveBeenCalledWith(false);
  expect(dashboard.getState()).toHaveProperty("isEditingCore", true);
  unmount(); expect(cancelFetch).toHaveBeenCalledTimes(1);
});
test("hosts read failure exposes retry and prevents saving unloaded data", async () => {
  const { fetchHosts } = hostsSetup(true);
  expect(await screen.findByRole("alert")).toHaveTextContent(/load/i);
  expect(screen.getByRole("button", { name: /save all/i })).toBeDisabled();
  fetchHosts.mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(fetchHosts).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});
test("core settings fetches on open, restarts and cancels on unmount", async () => {
  const dashboard = create(() => ({ isEditingCore: true }));
  const fetchCoreSettings = mock(async () => {});
  const restartCore = mock(async () => {});
  const cancelFetch = mock(() => {});
  const core = create(() => ({ config: "", version: "1.2.3", isLoading: true, isPostLoading: false, fetchCoreSettings, cancelFetch, restartCore, updateConfig: mock(async () => {}) }));
  const { CoreSettingsModal } = loadSource<typeof import("../../src/components/dashboard/core-settings-modal")>("components/dashboard/core-settings-modal.tsx", {
    ...localeAdapter, "@/contexts/dashboard-context": { useDashboard: dashboard }, "@/contexts/core-settings-context": { useCoreSettings: core },
    "./node-logs": { NodeLogs: () => <div /> }, sonner: { toast: { success: mock(() => {}), error: mock(() => {}) } },
  });
  const { unmount } = renderFrontend(<CoreSettingsModal />);
  expect(fetchCoreSettings).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("Xray v1.2.3")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /restart core/i }));
  await waitFor(() => expect(restartCore).toHaveBeenCalledTimes(1));
  unmount(); expect(cancelFetch).toHaveBeenCalledTimes(1);
});
test("nodes error provides retry", async () => {
  const dashboard = create(() => ({ isEditingNodes: true, onEditingNodes: mock(() => {}) }));
  const nodes = create(() => ({ setDeletingNode: mock(() => {}) }));
  const refetch = mock(() => {});
  const { NodesDialog } = loadSource<typeof import("../../src/components/dashboard/nodes-modal")>("components/dashboard/nodes-modal.tsx", {
    ...localeAdapter, "@/contexts/dashboard-context": { useDashboard: dashboard },
    "@/contexts/nodes-context": {
      ...loadSource<typeof import("../../src/contexts/nodes-context")>("contexts/nodes-context.tsx", { "service/http": { fetch: mock(async () => {}) }, "./dashboard-context": {} }),
      useNodes: nodes, useNodesQuery: () => ({ data: [], isLoading: false, isError: true, refetch }),
    },
    "./delete-node-modal": { DeleteNodeModal: () => null },
  });
  renderFrontend(<NodesDialog />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/load nodes/i);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});
