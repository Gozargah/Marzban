import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";

const cases = [
  ["reset-user-usage-modal", "ResetUserUsageModal", "resetUsageUser", "resetDataUsage", "Reset"],
  ["revoke-subscription-modal", "RevokeSubscriptionModal", "revokeSubscriptionUser", "revokeSubscription", "Revoke"],
  ["reset-all-usage-modal", "ResetAllUsageModal", "isResetingAllUsage", "resetAllUsage", "Reset"],
  ["delete-user-modal", "DeleteUserModal", "deletingUser", "deleteUser", "Delete"],
] as const;

test.each(cases)("%s confirms the intended action", async (file, exportName, selected, action, label) => {
  const user = { username: "alice" };
  const mutation = mock(async () => {});
  const store = create(() => ({
    [selected]: selected === "isResetingAllUsage" ? true : user,
    [action]: mutation, onResetAllUsage: mock(() => {}), onDeletingUser: mock(() => {}),
  }));
  const exports = loadSource(`components/dashboard/${file}.tsx`, {
    ...localeAdapter, "@/contexts/dashboard-context": { useDashboard: store },
    sonner: { toast: { success: mock(() => {}) } },
  });
  const Component = exports[exportName];
  renderFrontend(<Component />);
  fireEvent.click(await screen.findByRole("button", { name: label }));
  await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
  if (selected !== "isResetingAllUsage") expect(mutation).toHaveBeenCalledWith(user);
});
test("delete node invalidates the node cache and clears selection", async () => {
  const deleteNode = mock(async () => {});
  const setDeletingNode = mock((_node: unknown) => {});
  const deleteCallback = mock(() => {});
  const store = create(() => ({ deletingNode: { id: 7, name: "Edge" }, deleteNode, setDeletingNode }));
  const { DeleteNodeModal } = loadSource<typeof import("../../src/components/dashboard/delete-node-modal")>("components/dashboard/delete-node-modal.tsx", {
    ...localeAdapter,
    "@/contexts/nodes-context": { useNodes: store, FetchNodesQueryKey: "nodes" },
    "./delete-user-modal": { DeleteIcon: () => <span /> },
    sonner: { toast: { success: mock(() => {}) } },
  });
  const { client } = renderFrontend(<DeleteNodeModal deleteCallback={deleteCallback} />);
  client.setQueryData(["nodes"], [{ id: 7 }]);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  await waitFor(() => expect(setDeletingNode).toHaveBeenCalledWith(null));
  expect(deleteNode).toHaveBeenCalledTimes(1);
  expect(deleteCallback).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(["nodes"])?.isInvalidated).toBe(true);
});
