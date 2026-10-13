import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadSource } from "../helpers/load-source";
import { deferred } from "../helpers/network";
import { renderFrontend, localeAdapter } from "../helpers/render";

function setup(inbounds = new Map([ ["vless", [{ tag: "vless-tcp", protocol: "vless", network: "tcp", tls: "none" }]] ])) {
  const request = deferred();
  const createUser = mock((_body: any) => request.promise);
  const store = create(subscribeWithSelector(() => ({
    editingUser: null, isCreatingNewUser: true, inbounds,
    onCreateUser: mock((_open: boolean) => {}), onEditingUser: mock((_user: unknown) => {}),
    onDeletingUser: mock(() => {}), createUser, editUser: mock(() => request.promise),
    fetchUserUsage: mock(async () => ({ usages: [] })),
  })));
  const { UserDialog } = loadSource<typeof import("../../src/components/dashboard/user-dialog")>("components/dashboard/user-dialog.tsx", {
    ...localeAdapter, "@/contexts/dashboard-context": { useDashboard: store },
    "@/components/theme-provider": { useTheme: () => ({ resolvedTheme: "light" }) },
    "react-apexcharts": () => <div aria-label="Usage chart" />,
    sonner: { toast: { success: mock(() => {}) } },
  });
  const view = renderFrontend(<UserDialog />);
  const submit = () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
  return { ...view, store, createUser, request, submit };
}

test("create form submits selected protocols and converts GiB to bytes", async () => {
  const { createUser, request, submit, store } = setup();
  const user = userEvent.setup();
  await user.type(await screen.findByRole("textbox", { name: "Username" }), "alice");
  const data = screen.getByLabelText(/data limit/i);
  fireEvent.change(data, { target: { value: "1.5" } });
  submit();
  await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
  expect(createUser.mock.calls[0][0]).toMatchObject({ username: "alice", data_limit: 1610612736, status: "active", proxies: { vless: { flow: "" } }, inbounds: { vless: ["vless-tcp"] } });
  expect(createUser.mock.calls[0][0]).not.toHaveProperty("selected_proxies");
  submit(); expect(createUser).toHaveBeenCalledTimes(1);
  request.resolve(undefined);
  await waitFor(() => expect(store.getState().onCreateUser).toHaveBeenCalledWith(false));
});
test("no available protocols blocks creation with validation feedback", async () => {
  const { submit, createUser } = setup(new Map());
  await userEvent.setup().type(await screen.findByRole("textbox", { name: "Username" }), "alice");
  submit();
  expect(await screen.findByText(/select.*protocol/i)).toBeInTheDocument();
  expect(createUser).not.toHaveBeenCalled();
});
test("failed save keeps the form open and permits another save", async () => {
  const { createUser, request, submit, store } = setup();
  await userEvent.setup().type(await screen.findByRole("textbox", { name: "Username" }), "alice");
  submit(); await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
  request.reject(new Error("offline"));
  expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
  expect(store.getState().onCreateUser).not.toHaveBeenCalled();
  createUser.mockResolvedValueOnce(undefined);
  submit(); await waitFor(() => expect(createUser).toHaveBeenCalledTimes(2));
});
