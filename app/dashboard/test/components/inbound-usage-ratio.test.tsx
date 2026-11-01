import { test, expect, mock } from "bun:test";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import { renderFrontend, localeAdapter } from "../helpers/render";

function setupCoefficient(current?: number) {
  const net = network();
  const toast = { success: mock(() => {}), error: mock(() => {}) };
  const { InboundCoefficient } = loadSource<typeof import("../../src/features/hosts/inbound-coefficient")>(
    "features/hosts/inbound-coefficient.tsx",
    {
      ...localeAdapter,
      "service/http": net,
      sonner: { toast },
      "@/features/users/use-inbounds": {
        useInbounds: () => ({
          inbounds: new Map([["vless", [{ tag: "VLESS WS", protocol: "vless", usage_coefficient: current }]]]),
        }),
      },
    },
  );
  const view = renderFrontend(<InboundCoefficient tag="VLESS WS" />);
  return { net, toast, ...view };
}

test("usage ratio shows the stored value, defaults to 1, and Save is disabled until it changes", () => {
  setupCoefficient(1.5);
  expect(screen.getByLabelText("Usage ratio")).toHaveValue(1.5);
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});
test("missing coefficient from an older backend is treated as 1", () => {
  setupCoefficient(undefined);
  expect(screen.getByLabelText("Usage ratio")).toHaveValue(1);
});
test.each(["", "0", "-2", "101", "abc"])("invalid ratio %p cannot be saved", (value) => {
  const { net } = setupCoefficient(1);
  fireEvent.change(screen.getByLabelText("Usage ratio"), { target: { value } });
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(net.calls).toHaveLength(0);
});
test("saving sends the encoded tag and number, then reports success", async () => {
  const { net, toast } = setupCoefficient(1);
  fireEvent.change(screen.getByLabelText("Usage ratio"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(net.calls).toHaveLength(1));
  expect(net.calls[0].url).toBe("/inbounds/VLESS%20WS/usage-coefficient");
  expect(net.calls[0].options.method).toBe("PUT");
  expect(net.calls[0].options.body).toEqual({ usage_coefficient: 2 });
  expect(screen.getByLabelText("Usage ratio")).toBeDisabled();
  await act(async () => net.calls[0].resolve({}));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(screen.getByLabelText("Usage ratio")).not.toBeDisabled();
});
test("a failed save surfaces the server detail and keeps the typed value", async () => {
  const { net, toast } = setupCoefficient(1);
  fireEvent.change(screen.getByLabelText("Usage ratio"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(net.calls).toHaveLength(1));
  await act(async () => net.calls[0].reject({ response: { _data: { detail: "Inbound x doesn't exist" } } }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Inbound x doesn't exist"));
  expect(screen.getByLabelText("Usage ratio")).toHaveValue(3);
});

function setupUsage() {
  const net = network();
  const { InboundsUsage } = loadSource<typeof import("../../src/components/dashboard/inbounds-usage")>(
    "components/dashboard/inbounds-usage.tsx",
    { ...localeAdapter, "service/http": net },
  );
  return { net, ...renderFrontend(<InboundsUsage />) };
}
test("inbound usage card renders each share and total", async () => {
  const { net, container } = setupUsage();
  await waitFor(() => expect(net.calls).toHaveLength(1));
  expect(net.calls[0].url).toBe("/inbounds/usage");
  expect(net.calls[0].options.query.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/);
  await act(async () =>
    net.calls[0].resolve({
      usages: [
        { tag: "VLESS WS", uplink: 100, downlink: 700, total: 800, ratio: 0.8 },
        { tag: "TROJAN TCP", uplink: 50, downlink: 150, total: 200, ratio: 0.2 },
      ],
    }),
  );
  expect(await screen.findByText("VLESS WS")).toBeInTheDocument();
  expect(container).toHaveTextContent("80.0%");
  expect(container).toHaveTextContent("20.0%");
  expect(screen.getAllByRole("progressbar")).toHaveLength(2);
});
test.each([
  ["no traffic yet", () => ({ usages: [] }), "resolve"],
  ["a non-sudo admin (403)", () => new Error("forbidden"), "reject"],
] as const)("inbound usage card stays hidden for %s", async (_name, payload, mode) => {
  const { net, container } = setupUsage();
  await waitFor(() => expect(net.calls).toHaveLength(1));
  await act(async () => net.calls[0][mode](payload()));
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
