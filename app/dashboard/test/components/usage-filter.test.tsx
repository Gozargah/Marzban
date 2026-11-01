import { test, expect, mock, setSystemTime } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";

const { UsageFilter } = loadSource<typeof import("../../src/components/dashboard/usage-filter")>(
  "components/dashboard/usage-filter.tsx",
  localeAdapter,
);

test.each([
  ["7h", "2026-01-15T05:00:00"],
  ["1d", "2026-01-14T12:00:00"],
  ["1w", "2026-01-08T12:00:00"],
  ["1m", "2025-12-15T12:00:00"],
])("usage preset %s sends UTC range", (range, start) => {
  setSystemTime(new Date("2026-01-15T12:34:00Z"));
  const onChange = mock(() => {});
  renderFrontend(<UsageFilter defaultValue="3m" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: range }));
  expect(onChange).toHaveBeenCalledWith(range, { start });
  expect(screen.getByRole("button", { name: range })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "3m" })).toHaveAttribute("aria-pressed", "false");
});

test("absolute usage range uses the shared calendar and submits inclusive dates", async () => {
  setSystemTime(new Date("2026-01-15T12:34:00Z"));
  const onChange = mock(() => {});
  renderFrontend(<UsageFilter defaultValue="1d" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /custom/i }));
  await screen.findByRole("button", { name: "Absolute" });
  fireEvent.click(screen.getByRole("button", { name: "Absolute" }));
  const firstDay = await screen.findByRole("button", { name: /January 10th, 2026/ });
  fireEvent.click(firstDay);
  fireEvent.click(screen.getByRole("button", { name: /January 12th, 2026/ }));
  expect(onChange).toHaveBeenCalledWith("custom", {
    start: "2026-01-10T00:00:00",
    end: "2026-01-12T23:59:59",
  });
  await waitFor(() => expect(screen.queryByRole("button", { name: /January 12th, 2026/ })).not.toBeInTheDocument());
});
