import { test, expect, mock } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { deferred } from "../helpers/network";
import { renderFrontend, localeAdapter } from "../helpers/render";

function setup(open = true) {
  const request = deferred();
  const onConfirm = mock(() => request.promise);
  const onClose = mock(() => {});
  const success = mock(() => {});
  const { ConfirmationDialog } = loadSource<typeof import("../../src/components/dashboard/confirmation-dialog")>("components/dashboard/confirmation-dialog.tsx", {
    ...localeAdapter, sonner: { toast: { success } },
  });
  renderFrontend(<ConfirmationDialog open={open} onClose={onClose} onConfirm={onConfirm} title="Delete user" description="This deletes Alice." actionLabel="Delete" successMessage="Deleted" errorMessage="Could not delete" icon={<span />} destructive />);
  return { request, onConfirm, onClose, success };
}

test("closed confirmation does not show dialog or perform action", () => {
  const { onConfirm } = setup(false);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
});
test("cancel closes without mutation", async () => {
  const { onClose, onConfirm } = setup();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});
test("pending confirmation blocks repeated submissions and cancel; success closes", async () => {
  const { onConfirm, onClose, success, request } = setup();
  const action = await screen.findByRole("button", { name: "Delete" });
  fireEvent.click(action); fireEvent.click(action);
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(action).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(onClose).not.toHaveBeenCalled();
  request.resolve(undefined);
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(success).toHaveBeenCalledWith("Deleted", { duration: 3000, closeButton: true });
});
test("failure leaves dialog open with error and permits retry", async () => {
  const { onConfirm, onClose, success, request } = setup();
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  request.reject(new Error("offline"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete");
  expect(onClose).not.toHaveBeenCalled(); expect(success).not.toHaveBeenCalled();
  onConfirm.mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});
