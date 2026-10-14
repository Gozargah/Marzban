import { test, expect, mock, setSystemTime } from "bun:test";
import { screen, fireEvent } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";

const { UsageFilter } = loadSource<typeof import("../../src/components/dashboard/usage-filter")>("components/dashboard/usage-filter.tsx", localeAdapter);

test.each([["7h", "2026-01-15T05:00:00"], ["1d", "2026-01-14T12:00:00"], ["1w", "2026-01-08T12:00:00"], ["1m", "2025-12-15T12:00:00"]])("usage preset %s sends UTC range", (range, start) => {
  setSystemTime(new Date("2026-01-15T12:34:00Z"));
  const onChange = mock(() => {});
  renderFrontend(<UsageFilter defaultValue="3m" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: range }));
  expect(onChange).toHaveBeenCalledWith(range, { start });
  expect(screen.getByRole("button", { name: range })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "3m" })).toHaveAttribute("aria-pressed", "false");
});
