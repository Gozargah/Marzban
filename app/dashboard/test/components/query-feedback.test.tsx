import { test, expect, mock } from "bun:test";
import { screen, fireEvent } from "@testing-library/react";
import { QueryFeedback } from "../../src/components/dashboard/query-feedback";
import { renderFrontend } from "../helpers/render";
test("offline feedback distinguishes paused requests from loading", () => {
  renderFrontend(<QueryFeedback loading refreshing={false} failed={false} offline />);
  expect(screen.getByRole("status")).toHaveTextContent("Waiting for a network connection.");
});
test("failed refresh exposes retry without a last-updated timestamp", () => {
  const retry = mock(() => {});
  renderFrontend(<QueryFeedback loading={false} refreshing={false} failed updatedAt={Date.now()} retry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/last loaded data/i);
  expect(screen.queryByText(/last updated/i)).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("background refresh stays silent while initial loading remains visible", () => {
  const view = renderFrontend(<QueryFeedback loading={false} refreshing failed={false} />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText(/refreshing/i)).toBeNull();
  view.unmount();
  renderFrontend(<QueryFeedback loading refreshing={false} failed={false} />);
  expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
});
