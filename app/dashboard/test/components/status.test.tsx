import { test, expect, setSystemTime } from "bun:test";
import { screen } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";

const { OnlineStatus } = loadSource<typeof import("../../src/components/dashboard/table/online-status")>("components/dashboard/table/online-status.tsx", localeAdapter);
const { StatusBadge } = loadSource<typeof import("../../src/components/dashboard/table/status-badge")>("components/dashboard/table/status-badge.tsx");

test.each([null, "invalid"])("unknown last connection %s", (lastOnline) => {
  renderFrontend(<OnlineStatus lastOnline={lastOnline} />);
  expect(screen.getByText("Not connected yet")).toBeInTheDocument();
});
test.each(["2026-01-15T12:00:00", "2026-01-15T12:00:00Z", "2026-01-15T15:30:00+03:30"])("equivalent UTC and offset timestamps %s", (lastOnline) => {
  setSystemTime(new Date("2026-01-15T12:00:30Z"));
  renderFrontend(<OnlineStatus lastOnline={lastOnline} />);
  expect(screen.getByText("Online")).toBeInTheDocument();
});
test("older connections use relative time", () => {
  setSystemTime(new Date("2026-01-15T12:00:00Z"));
  renderFrontend(<OnlineStatus lastOnline="2026-01-15T10:00:00Z" />);
  expect(screen.getByText("2 hours ago")).toBeInTheDocument();
});
test.each(["active", "disabled", "limited", "expired", "on_hold"] as const)("renders translated %s status and extra detail", (status) => {
  const { container, i18n } = renderFrontend(<StatusBadge status={status} extraText="demo" />);
  expect(container).toHaveTextContent(`${i18n.t(`status.${status}`)}: demo`);
});
test("compact icon-only status hides text detail", () => {
  const { container } = renderFrontend(<StatusBadge status="active" compact showDetail={false} extraText="hidden" />);
  expect(container.textContent).toBe("");
  expect(container.querySelector("svg")).not.toBeNull();
});
