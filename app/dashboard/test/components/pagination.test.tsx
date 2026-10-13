import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend } from "../helpers/render";

function setup(patch: Record<string, unknown> = {}) {
  const onFilterChange = mock((_filters: any) => {});
  const store = create(() => ({ filters: { limit: 10, offset: 0 }, users: { total: 35 }, loading: false, usersError: false, onFilterChange, ...patch }));
  const { Pagination } = loadSource<typeof import("../../src/components/dashboard/table/users-pagination")>("components/dashboard/table/users-pagination.tsx", {
    "@/contexts/dashboard-context": { useDashboard: store },
  });
  renderFrontend(<Pagination />);
  return { onFilterChange, store };
}

test("first page shows range and disables previous", () => {
  const { onFilterChange } = setup();
  expect(screen.getByText("1–10 / 35")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(onFilterChange).toHaveBeenCalledWith({ offset: 10 });
});
test("last partial page disables next", () => {
  setup({ filters: { limit: 10, offset: 30 } });
  expect(screen.getByText("31–35 / 35")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
});
test("page size resets offset and persists preference", () => {
  const { onFilterChange } = setup();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "50" } });
  expect(onFilterChange).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  expect(localStorage.getItem("marzban-num-users-per-page")).toBe("50");
});
test("empty results stay on page one with disabled navigation", () => {
  setup({ users: { total: 0 } });
  expect(screen.getByText("0–0 / 0")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
});
test("loading prevents navigation and changing size", () => {
  const { onFilterChange } = setup({ loading: true });
  expect(screen.getByRole("combobox")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(onFilterChange).not.toHaveBeenCalled();
});
test("deleted last page moves to the last valid offset", async () => {
  const { onFilterChange } = setup({ filters: { limit: 10, offset: 30 }, users: { total: 20 } });
  await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith({ offset: 10 }));
});
test("failed results do not silently change page", () => {
  const { onFilterChange } = setup({ filters: { limit: 10, offset: 30 }, users: { total: 0 }, usersError: true });
  expect(onFilterChange).not.toHaveBeenCalled();
});
test("large result sets bound the number of page buttons", () => {
  setup({ users: { total: 10000 }, filters: { limit: 10, offset: 5000 } });
  expect(screen.getAllByRole("button").length).toBeLessThanOrEqual(9);
  expect(screen.getByRole("button", { current: "page" })).toHaveTextContent("501");
});
