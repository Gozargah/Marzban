import { test, expect, mock, spyOn } from "bun:test";
import { act, screen, fireEvent } from "@testing-library/react";
import { useEffect } from "react";
import { createDeferredDialog, createImmediateDialog } from "../../src/components/dashboard/deferred-dialog";
import { deferred } from "../helpers/network";
import { renderFrontend } from "../helpers/render";

test("closed dialog loads on first open and retains its mount for closing animations", async () => {
  const pending = deferred<{ default: () => React.ReactNode }>();
  const load = mock(() => pending.promise);
  const mounted = mock(() => {}), unmounted = mock(() => {});
  function Dialog() { useEffect(() => { mounted(); return unmounted; }, []); return <div>Sheet loaded</div>; }
  const Deferred = createDeferredDialog(load);
  const view = renderFrontend(<Deferred open={false} />);
  expect(load).not.toHaveBeenCalled();
  view.rerender(<Deferred open />);
  expect(load).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  await act(async () => { pending.resolve({ default: Dialog }); });
  expect(await screen.findByText("Sheet loaded")).toBeInTheDocument();
  view.rerender(<Deferred open={false} />);
  expect(mounted).toHaveBeenCalledTimes(1); expect(unmounted).not.toHaveBeenCalled();
  view.rerender(<Deferred open />); expect(load).toHaveBeenCalledTimes(1);
  view.unmount(); expect(unmounted).toHaveBeenCalledTimes(1);
});
test("import errors have cancel and retry actions", async () => {
  spyOn(console, "error").mockImplementation(() => {});
  const pending = deferred<{ default: () => React.ReactNode }>();
  const load = mock(() => pending.promise), cancel = mock(() => {});
  const Deferred = createDeferredDialog(load);
  renderFrontend(<Deferred open onClose={cancel} />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(cancel).toHaveBeenCalledTimes(1);
  await act(async () => pending.reject(new Error("offline")));
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not open/i);
  load.mockResolvedValueOnce({ default: () => <div>Recovered</div> });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Recovered")).toBeInTheDocument(); expect(load).toHaveBeenCalledTimes(2);
});
test("one pending feature does not prevent another from rendering", async () => {
  const pending = deferred<{ default: () => React.ReactNode }>();
  const Slow = createDeferredDialog(() => pending.promise);
  const Fast = createDeferredDialog(async () => ({ default: () => <div>Fast dialog</div> }));
  renderFrontend(<><Slow open /><Fast open /></>);
  expect(await screen.findByText("Fast dialog")).toBeInTheDocument();
  await act(async () => pending.resolve({ default: () => null }));
});

test("immediate shells open synchronously without a loading intermediary and retain their mount", () => {
  const mounted = mock(() => {}), unmounted = mock(() => {});
  function Shell() { useEffect(() => { mounted(); return unmounted; }, []); return <div>Immediate sheet</div>; }
  const Immediate = createImmediateDialog(Shell);
  const view = renderFrontend(<Immediate open={false} />);
  expect(mounted).not.toHaveBeenCalled();
  view.rerender(<Immediate open />);
  expect(screen.getByText("Immediate sheet")).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
  view.rerender(<Immediate open={false} />);
  view.rerender(<Immediate open />);
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
  view.unmount();
  expect(unmounted).toHaveBeenCalledTimes(1);
});
