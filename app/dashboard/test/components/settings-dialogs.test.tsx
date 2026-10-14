import { test, expect, mock } from "bun:test";
import { create } from "zustand";
import { act, screen, fireEvent, waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";
import { network } from "../helpers/network";
function hostsSetup() {
  const net = network(), onEditingHosts = mock((_open: boolean) => {});
  const dashboard = create(() => ({ isEditingHosts: true, onEditingHosts }));
  const { HostsDialog } = loadSource<typeof import("../../src/components/dashboard/hosts-dialog")>("components/dashboard/hosts-dialog.tsx", {
    ...localeAdapter, "service/http": net, "@/contexts/dashboard-context": { useDashboard: dashboard },
  });
  return { ...renderFrontend(<HostsDialog />), net, dashboard, onEditingHosts };
}
test("empty hosts offers configuration and unmount cancels pending retry", async () => {
  const { net, dashboard, onEditingHosts, unmount, client } = hostsSetup();
  await act(async () => net.calls[0].resolve({}));
  fireEvent.click(await screen.findByRole("button", { name: /configure inbounds/i }));
  expect(onEditingHosts).toHaveBeenCalledWith(false); expect(dashboard.getState()).toHaveProperty("isEditingCore", true);
  void client.invalidateQueries({ queryKey: ["hosts"] }); await waitFor(() => expect(net.calls).toHaveLength(2));
  unmount(); expect(net.calls[1].options.signal.aborted).toBe(true); net.calls[1].resolve({});
});
test("hosts failure offers retry and prevents saving unloaded data", async () => {
  const { net } = hostsSetup(); await act(async () => net.calls[0].reject(new Error("offline")));
  expect(await screen.findByRole("alert")).toHaveTextContent(/load/i);
  expect(screen.getByRole("button", { name: /save all/i })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(net.calls).toHaveLength(2)); await act(async () => net.calls[1].resolve({}));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});
test("core loads info and config, restarts, and keeps an unsaved draft during refresh", async () => {
  const net = network(); const dashboard = create(() => ({ isEditingCore: true }));
  const { CoreSettingsModal } = loadSource<typeof import("../../src/components/dashboard/core-settings-modal")>("components/dashboard/core-settings-modal.tsx", {
    ...localeAdapter, "service/http": net, "@/contexts/dashboard-context": { useDashboard: dashboard, fetchInbounds: mock(async () => {}) },
    "./node-logs": { NodeLogs: () => null },
    "../JsonEditor": { JsonEditor: ({ json, onChange }: any) => <textarea aria-label="Configuration" value={json} onChange={(event) => onChange(event.target.value)} /> },
    sonner: { toast: { success: mock(() => {}), error: mock(() => {}) } },
  });
  const { client } = renderFrontend(<CoreSettingsModal />);
  await act(async () => { net.calls[0].resolve({ version: "1.2.3", started: true }); net.calls[1].resolve({ old: true }); });
  const editor = await screen.findByRole("textbox", { name: "Configuration" });
  fireEvent.change(editor, { target: { value: '{"draft":true}' } });
  act(() => { client.setQueryData(["core-settings"], { version: "2", config: '{"server":true}' }); });
  expect(editor).toHaveValue('{"draft":true}');
  fireEvent.click(screen.getByRole("button", { name: /restart core/i }));
  await waitFor(() => expect(net.calls).toHaveLength(3)); expect(net.calls[2].url).toBe("/core/restart");
  await act(async () => net.calls[2].resolve({}));
});
