import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { screen, fireEvent, act, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend } from "../helpers/render";

function setup(patch = {}) {
  const onFilterChange = mock((_value: any) => {});
  const refetchUsers = mock(() => {});
  const onCreateUser = mock((_open: boolean) => {});
  const store = create(subscribeWithSelector(() => ({ filters: { search: "", offset: 20 }, loading: false, usersError: false, onFilterChange, refetchUsers, onCreateUser, ...patch })));
  const { Filters } = loadSource<typeof import("../../src/components/dashboard/filters")>("components/dashboard/filters.tsx", { "@/contexts/dashboard-context": { useDashboard: store } });
  return { ...renderFrontend(<Filters />), store, onFilterChange, refetchUsers, onCreateUser };
}

test("search debounces input and resets pagination", async () => {
  const { onFilterChange } = setup();
  fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "ali" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "alice" } });
  expect(onFilterChange).not.toHaveBeenCalled();
  await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith({ offset: 0, search: "alice" }));
  expect(onFilterChange).toHaveBeenCalledTimes(1);
});
test("unmount cancels pending search", async () => {
  const { unmount, onFilterChange } = setup();
  fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "alice" } });
  unmount();
  // A real debounce interval is needed to prove nothing fires after cleanup.
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(onFilterChange).not.toHaveBeenCalled();
});
test("external search updates the input and clear resets it", () => {
  const { store, onFilterChange } = setup();
  act(() => store.setState({ filters: { search: "alice", offset: 20 } }));
  expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("alice");
  fireEvent.click(screen.getByRole("button", { name: /clear/i }));
  expect(onFilterChange).toHaveBeenCalledWith({ search: "", offset: 0 });
  expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
});
test("refresh retries failed users and create opens the form", () => {
  const { refetchUsers, onCreateUser } = setup({ usersError: true });
  expect(screen.getByRole("alert")).toHaveTextContent(/refresh/i);
  fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
  expect(refetchUsers).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: /create/i }));
  expect(onCreateUser).toHaveBeenCalledWith(true);
});
