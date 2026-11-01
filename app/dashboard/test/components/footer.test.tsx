import { test, expect } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import { renderFrontend } from "../helpers/render";

function setup() {
  const net = network();
  const { Footer } = loadSource<typeof import("../../src/components/footer")>("components/footer.tsx", {
    "service/http": { $fetch: net.fetch },
  });
  return { net, ...renderFrontend(<Footer />) };
}

test("loads and displays the server version", async () => {
  const { net } = setup();
  await waitFor(() => expect(net.calls).toHaveLength(1));
  expect(net.calls[0]).toMatchObject({ url: "/version", options: { retry: 0 } });
  expect(net.calls[0].options.signal).toBeInstanceOf(AbortSignal);
  net.calls[0].resolve({ version: "1.2.3" });
  await waitFor(() => expect(screen.getByRole("contentinfo")).toHaveTextContent("v1.2.3"));
});

test("keeps the footer usable when the version endpoint is unavailable", async () => {
  const { net } = setup();
  await waitFor(() => expect(net.calls).toHaveLength(1));
  net.calls[0].reject(new Error("offline"));
  expect(await screen.findByRole("contentinfo")).toHaveTextContent("Marzban");
  expect(screen.queryByText(/v\d/)).not.toBeInTheDocument();
  expect(net.calls).toHaveLength(1);
});
