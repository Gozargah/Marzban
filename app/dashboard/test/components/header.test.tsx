import { expect, mock, test, spyOn } from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "zustand";
import { loadSource } from "../helpers/load-source";
import { localeAdapter, renderFrontend } from "../helpers/render";

function setup(sudo = true, desktop = false) {
  spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: desktop && query === "(min-width: 768px)", media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));
  const reset = mock(() => {}), logout = mock(() => {});
  const store = create(() => ({ onEditingHosts: mock(() => {}), onEditingNodes: mock(() => {}), onShowingNodesUsage: mock(() => {}), onResetAllUsage: reset }));
  const { Header } = loadSource<typeof import("../../src/components/dashboard/header")>("components/dashboard/header.tsx", {
    ...localeAdapter,
    "@/contexts/dashboard-context": { useDashboard: store },
    "hooks/useGetUser": { __esModule: true, default: () => ({ userData: { username: "alice", is_sudo: sudo }, getUserIsSuccess: true, getUserIsPending: false }) },
    "@/components/theme-provider": { useTheme: () => ({ resolvedTheme: "dark", setTheme: mock(() => {}) }) },
    "@/components/language": { Language: () => <button>Language</button> },
    "react-github-btn": { __esModule: true, default: (props: any) => <a {...props}>Star</a> },
    "react-router": { Link: ({ to, ...props }: any) => <a href={to} {...props} /> },
    "utils/authStorage": { removeAuthToken: logout },
  });
  const view = renderFrontend(<Header />);
  return { ...view, reset, logout };
}

test("hamburger contains logout and reset while the original stars sit beside language", async () => {
  const { reset, logout, client } = setup();
  client.setQueryData(["private"], { username: "alice" });
  const star = screen.getByRole("link", { name: "Star Marzban on GitHub" });
  expect(star).toHaveAttribute("data-show-count", "true");
  expect(star).toHaveAttribute("data-size", "large");
  expect(screen.getByRole("button", { name: "Language" }).nextElementSibling).toContainElement(star);
  expect(screen.queryByRole("link", { name: /log\s*out/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /reset all usage/i })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Dashboard menu" }));
  expect(screen.getByRole("button", { name: /reset all usage/i })).toBeInTheDocument();
  expect(reset).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole("link", { name: /log\s*out/i }));
  expect(logout).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(["private"])).toBeUndefined();
});

test("non-sudo accounts have logout in the menu without reset-all-usage", async () => {
  setup(false);
  await userEvent.setup().click(screen.getByRole("button", { name: "Dashboard menu" }));
  expect(screen.getByRole("link", { name: /log\s*out/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /reset all usage/i })).toBeNull();
});

test("desktop account popover contains only reset and logout", async () => {
  setup(true, true);
  await userEvent.setup().click(screen.getByRole("button", { name: "Dashboard menu" }));
  const menu = screen.getByRole("menu");
  expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  expect(menu).toHaveTextContent(/reset all usage/i);
  expect(menu).toHaveTextContent(/log\s*out/i);
  expect(menu).not.toHaveTextContent(/preferences|signed in as|donation|host settings/i);
  expect(screen.queryByRole("dialog")).toBeNull();
});
