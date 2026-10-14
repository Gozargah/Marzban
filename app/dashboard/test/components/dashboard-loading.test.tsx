import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { act, screen } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";

// Keep dashboard orchestration real; substitute only feature contents and router/network boundaries.
test("dashboard renders no closed dialogs and opens only the requested feature", async () => {
  const flags = { editingUser: null, isCreatingNewUser: false, isEditingCore: false, isEditingNodes: false, isEditingHosts: false,
    deletingUser: null, QRcodeLinks: null, resetUsageUser: null, revokeSubscriptionUser: null, isShowingNodesUsage: false, isResetingAllUsage: false };
  const store = create(() => ({ ...flags, onFilterChange: mock(() => {}) }));
  const mounts = Object.fromEntries(["UserDialog", "CoreSettingsModal", "NodesDialog", "HostsDialog"].map((name) => [name, mock(() => {})]));
  const adapters: Record<string, unknown> = {
    ...localeAdapter,
    "@/features/shared/dialog-preload": { preloadTrafficChart: mock(async () => {}) },
    "@/features/users/use-inbounds": { useInbounds: () => ({ inbounds: new Map(), loading: false, failed: false }) },
    "@/contexts/dashboard-context": { useDashboard: store, fetchInbounds: mock(async () => {}), cancelUsersRequest: mock(() => {}) },
    "@/pages/router": { router: { state: { location: { search: "" } }, subscribe: () => () => {} } },
    "@/components/footer": { Footer: () => null }, "@/components/dashboard/header": { Header: () => null },
    "@/components/dashboard/statistics": { Statistics: () => null }, "@/components/dashboard/filters": { Filters: () => null },
    "@/components/dashboard/table/users-table": { UsersTable: () => <div>Dashboard ready</div> },
  };
  for (const [file, name] of [["user-dialog", "UserDialog"], ["core-settings-modal", "CoreSettingsModal"], ["nodes-modal", "NodesDialog"], ["hosts-dialog", "HostsDialog"]]) {
    adapters[`@/components/dashboard/${file}`] = { [name]: () => { mounts[name](); return <div>{name}</div>; } };
  }
  for (const [file, name] of [["delete-user-modal", "DeleteUserModal"], ["qr-code-dialog", "QRCodeDialog"], ["nodes-usage", "NodesUsage"], ["reset-user-usage-modal", "ResetUserUsageModal"], ["revoke-subscription-modal", "RevokeSubscriptionModal"], ["reset-all-usage-modal", "ResetAllUsageModal"]]) {
    adapters[`@/components/dashboard/${file}`] = { [name]: () => null };
  }
  const { Dashboard } = loadSource<typeof import("../../src/pages/dashboard")>("pages/dashboard.tsx", adapters);
  renderFrontend(<Dashboard />);
  expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
  for (const mount of Object.values(mounts)) expect(mount).not.toHaveBeenCalled();
  act(() => store.setState({ isEditingHosts: true }));
  expect(screen.getByText("HostsDialog")).toBeInTheDocument();
  expect(mounts.UserDialog).not.toHaveBeenCalled(); expect(mounts.NodesDialog).not.toHaveBeenCalled(); expect(mounts.CoreSettingsModal).not.toHaveBeenCalled();
});
