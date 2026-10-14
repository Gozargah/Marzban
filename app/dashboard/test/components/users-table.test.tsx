import { usersAdapter } from "../helpers/users-adapter";
import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { screen, fireEvent } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";
import { makeUser } from "../helpers/fixtures";

function setup(patch: Record<string, unknown> = {}) {
  const onFilterChange = mock((_filters: unknown) => {});
  const onCreateUser = mock((_open: boolean) => {});
  const onEditingUser = mock((_user: unknown) => {});
  const store = create(() => ({ filters: { sort: "-created_at", limit: 10 }, users: { users: [], total: 0 }, loading: false, usersError: false,
    onFilterChange, onCreateUser, onEditingUser, setQRCode: mock(() => {}), setSubLink: mock(() => {}), ...patch }));
  const { UsersTable } = loadSource<typeof import("../../src/components/dashboard/table/users-table")>("components/dashboard/table/users-table.tsx", {
    ...localeAdapter, ...usersAdapter(store), "@/contexts/dashboard-context": { useDashboard: store },
    "assets/add_file.svg?react": () => <svg aria-hidden="true" />,
  });
  return { ...renderFrontend(<UsersTable />), onFilterChange, onCreateUser, onEditingUser };
}

test("empty users offer creation", () => {
  const { onCreateUser } = setup();
  // Both mobile and desktop layouts exist in the DOM; CSS determines visibility in a browser.
  fireEvent.click(screen.getAllByRole("button", { name: /create/i })[0]);
  expect(onCreateUser).toHaveBeenCalledWith(true);
});
test("empty filtered users can clear filters", () => {
  const { onFilterChange } = setup({ filters: { sort: "-created_at", search: "alice" } });
  fireEvent.click(screen.getAllByRole("button", { name: /clear filters/i })[0]);
  expect(onFilterChange).toHaveBeenCalledWith({ search: "", status: undefined, offset: 0 });
});
test("failed initial read does not suggest the database has no users", () => {
  setup({ usersError: true });
  expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
});
test("users render identity and sorting resets pagination", () => {
  const user = makeUser();
  const { onFilterChange } = setup({ users: { users: [user], total: 1 } });
  expect(screen.getAllByText("alice").length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button", { name: "Users" })[0]);
  expect(onFilterChange).toHaveBeenCalledWith({ sort: "username", offset: 0 });
});

test("desktop row can open the user editor with the keyboard", () => {
  const user = makeUser(); const { onEditingUser } = setup({ users: { users: [user], total: 1 } });
  const row = screen.getByRole("row", { name: "Edit alice" });
  expect(row).toHaveAttribute("tabindex", "0"); fireEvent.keyDown(row, { key: "Enter" });
  expect(onEditingUser).toHaveBeenCalledWith(user);
});
