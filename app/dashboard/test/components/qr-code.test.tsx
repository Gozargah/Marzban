import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { screen, fireEvent, act } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";

function setup(links: string[] | null = ["vless://first", "vless://second"], subscription = "/sub/demo") {
  const setQRCode = mock((_links: string[] | null) => {});
  const setSubLink = mock((_link: string | null) => {});
  const store = create(() => ({ QRcodeLinks: links, subscribeUrl: subscription, setQRCode, setSubLink }));
  const { QRCodeDialog } = loadSource<typeof import("../../src/components/dashboard/qr-code-dialog")>("components/dashboard/qr-code-dialog.tsx", {
    ...localeAdapter, "@/contexts/dashboard-context": { useDashboard: store },
    // Canvas drawing is a browser concern. Assert the exact payload sent to QR encoder.
    "qrcode.react": { QRCodeCanvas: ({ value }: { value: string }) => <output data-testid="qr-value">{value}</output> },
  });
  renderFrontend(<QRCodeDialog />);
  return { store, setQRCode, setSubLink };
}

test("QR carousel wraps in both directions and resolves relative subscription URLs", async () => {
  setup();
  await screen.findByRole("dialog");
  expect(screen.getByText("http://localhost/sub/demo")).toBeInTheDocument();
  expect(screen.getByText("vless://first")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(screen.getByText("vless://second")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(screen.getByText("vless://first")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /previous/i }));
  expect(screen.getByText("vless://second")).toBeInTheDocument();
});
test("replacing links resets the carousel and disables navigation for one link", async () => {
  const { store } = setup();
  fireEvent.click(await screen.findByRole("button", { name: /next/i }));
  act(() => store.setState({ QRcodeLinks: ["vless://new"] }));
  expect(screen.getByText("vless://new")).toBeInTheDocument();
  expect(screen.getByText("1 / 1")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
});
test("closing QR dialog clears both connection links and subscription", async () => {
  const { setQRCode, setSubLink } = setup();
  fireEvent.click(await screen.findByRole("button", { name: /close/i }));
  expect(setQRCode).toHaveBeenCalledWith(null);
  expect(setSubLink).toHaveBeenCalledWith(null);
});
test("null links keep QR dialog closed", () => {
  setup(null);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
