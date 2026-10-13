import { test, expect } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import { renderFrontend, localeAdapter } from "../helpers/render";

function setup() {
  const net = network();
  const { Statistics } = loadSource<typeof import("../../src/components/dashboard/statistics")>("components/dashboard/statistics.tsx", { ...localeAdapter, "service/http": net });
  const view = renderFrontend(<Statistics />);
  return { net, ...view };
}
const data = { users_active: 1234, total_user: 2000, incoming_bandwidth: 1024, outgoing_bandwidth: 1024, mem_used: 1073741824, mem_total: 2147483648 };

test("statistics announces loading and renders API values", async () => {
  const { net, container } = setup();
  expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  await waitFor(() => expect(net.calls).toHaveLength(1));
  expect(net.calls[0].url).toBe("/system");
  expect(net.calls[0].options.signal).toBeInstanceOf(AbortSignal);
  net.calls[0].resolve(data);
  expect(await screen.findByText("1,234")).toBeInTheDocument();
  expect(container).toHaveTextContent("2 KB");
  expect(container).toHaveTextContent("GB / 2 GB");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
test("statistics failure exposes retry, then recovers", async () => {
  const { net } = setup();
  await waitFor(() => expect(net.calls).toHaveLength(1));
  net.calls[0].reject(new Error("offline"));
  expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(net.calls).toHaveLength(2));
  net.calls[1].resolve(data);
  await screen.findByText("1,234");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
