import { test, expect } from "bun:test";
import { screen } from "@testing-library/react";
import { TrafficChart } from "../../src/features/shared/traffic-chart";
import { createUsageData } from "../../src/features/shared/traffic";
import { renderFrontend } from "../helpers/render";
test("empty traffic has an explicit empty state", () => {
  renderFrontend(<TrafficChart usage={createUsageData()} />); expect(screen.getByRole("status")).toHaveTextContent(/no usage/i);
});
test("traffic preserves label order, totals and accessible numeric legend", () => {
  const usage = createUsageData([1024, 2048], ["Master", "Edge"]);
  expect(usage.total).toBe("3 KB"); expect(usage.colors).toHaveLength(2);
  renderFrontend(<TrafficChart usage={usage} />);
  expect(screen.getByText("Master")).toBeInTheDocument(); expect(screen.getByText("Edge")).toBeInTheDocument();
  expect(screen.getByText("1 KB")).toBeInTheDocument(); expect(screen.getByText("2 KB")).toBeInTheDocument();
});
