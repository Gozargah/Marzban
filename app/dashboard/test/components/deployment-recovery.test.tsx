import { act,fireEvent,renderHook,screen } from "@testing-library/react";
import { afterEach,expect,mock,test } from "bun:test";
import { useForm } from "react-hook-form";
import { DeploymentRecovery } from "../../src/components/deployment-recovery";
import { clearAllDrafts,readDraft,saveDraft } from "../../src/features/shared/drafts";
import { useRecoverableDraft } from "../../src/features/shared/use-recoverable-draft";
import { renderFrontend } from "../helpers/render";
afterEach(clearAllDrafts);
test("deployment failure prompts reload but never reloads automatically", () => {
  const reload = mock(() => {}); saveDraft("core", { config: "draft" });
  renderFrontend(<DeploymentRecovery reload={reload} />);
  const event = new Event("vite:preloadError", { cancelable: true });
  act(() => window.dispatchEvent(event)); expect(event.defaultPrevented).toBe(true); expect(reload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /reload application/i }));
  expect(reload).toHaveBeenCalledTimes(1); expect(readDraft("core")).toEqual({ config: "draft" });
});
test("failed draft persistence blocks reload and permits continued editing", () => {
  const blockedStorage = { getItem: () => null, setItem: () => { throw new Error("quota"); } }; saveDraft("core", { config: "draft" }, blockedStorage);
  const reload = mock(() => {}); renderFrontend(<DeploymentRecovery reload={reload} />);
  act(() => window.dispatchEvent(new Event("vite:preloadError")));
  fireEvent.click(screen.getByRole("button", { name: /reload application/i }));
  expect(reload).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toHaveTextContent(/save or discard/i);
  fireEvent.click(screen.getByRole("button", { name: /keep editing/i })); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
test("form restores saved values and persists current edits before reload", () => {
  saveDraft("test-form", { name: "draft" });
  const { result } = renderHook(() => {
    const form = useForm({ defaultValues: { name: "server" } }); useRecoverableDraft("test-form", form, true); return form;
  });
  expect(result.current.getValues().name).toBe("draft");
  act(() => result.current.setValue("name", "updated", { shouldDirty: true }));
  expect(readDraft("test-form")).toEqual({ name: "updated" });
});

test("reload flushes buffered editor changes before preserving drafts", () => {
  const reload = mock(() => {});
  const flush = () => { saveDraft("core", { config: "newest edit" }); };
  window.addEventListener("marzban:flush-drafts", flush);
  try {
    renderFrontend(<DeploymentRecovery reload={reload} />);
    act(() => window.dispatchEvent(new Event("vite:preloadError")));
    fireEvent.click(screen.getByRole("button", { name: /reload application/i }));
    expect(readDraft("core")).toEqual({ config: "newest edit" }); expect(reload).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener("marzban:flush-drafts", flush); }
});
