import { afterEach,expect,setSystemTime,test } from "bun:test";
import { canReloadWithoutLosingDrafts,clearAllDrafts,clearDraft,readDraft,saveDraft } from "../../src/features/shared/drafts";
import { removeAuthToken,setAuthToken } from "../../src/utils/authStorage";
afterEach(clearAllDrafts);
test("drafts persist independently, expire and clear after discard", () => {
  setSystemTime(new Date("2026-01-01T00:00:00Z"));
  expect(saveDraft("user:new", { username: "alice" })).toBe(true);
  saveDraft("core", { config: "{}" }); clearDraft("core");
  expect(readDraft("user:new")).toEqual({ username: "alice" }); expect(readDraft("core")).toBeUndefined();
  setSystemTime(new Date("2026-01-01T07:00:00Z")); expect(readDraft("user:new")).toBeUndefined();
});
test("malformed persisted input is ignored", () => {
  sessionStorage.setItem("marzban-editor-drafts", "broken"); expect(readDraft("core")).toBeUndefined();
  sessionStorage.setItem("marzban-editor-drafts", '{"core":{"version":1,"savedAt":"bad","values":{}}}'); expect(readDraft("core")).toBeUndefined();
});
test("storage failure prevents reload until edits are saved or discarded", () => {
  const blockedStorage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  expect(saveDraft("core", { config: "draft" }, blockedStorage)).toBe(false); expect(canReloadWithoutLosingDrafts()).toBe(false);
  clearDraft("core"); expect(canReloadWithoutLosingDrafts()).toBe(true);
});
test("logout clears drafts and preserves harmless page preferences", () => {
  setAuthToken("token"); saveDraft("core", { config: "private" }); localStorage.setItem("marzban-num-users-per-page", "50");
  removeAuthToken(); expect(readDraft("core")).toBeUndefined(); expect(localStorage.getItem("marzban-num-users-per-page")).toBe("50");
});

test("reload refreshes expired storage from the still-open editor snapshot", () => {
  setSystemTime(new Date("2026-01-01T00:00:00Z")); saveDraft("core", { config: "live edit" });
  setSystemTime(new Date("2026-01-01T07:00:00Z")); expect(readDraft("core")).toBeUndefined();
  expect(canReloadWithoutLosingDrafts()).toBe(true); expect(readDraft("core")).toEqual({ config: "live edit" });
});
