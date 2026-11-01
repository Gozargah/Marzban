import { afterEach,expect,setSystemTime,test } from "bun:test";
import { canReloadWithoutLosingDrafts,clearAllDrafts,clearDraft,readDraft,saveDraft } from "../../src/features/shared/drafts";
import { clearAuthState } from "../../src/utils/authStorage";
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
test("recoverable drafts omit credential fields recursively", () => {
  saveDraft("user:alice", {
    username: "alice",
    id: "harmless-record-id",
    proxies: { vless: { id: "private-id", flow: "vision", psk: "secret-psk", shortId: "short-secret" }, trojan: { password: "secret" } },
    config: { inbounds: [{ clients: [{ id: "client-id", email: "alice" }] }], tlsSettings: { key: "private-key", cert: "public-cert" } },
    hosts: [{ private_key: "private-key", remark: "edge" }],
  });
  expect(readDraft("user:alice")).toEqual({
    username: "alice",
    id: "harmless-record-id",
    proxies: { vless: { flow: "vision" }, trojan: {} },
    config: { inbounds: [{ clients: [{ email: "alice" }] }], tlsSettings: { cert: "public-cert" } },
    hosts: [{ remark: "edge" }],
  });
});
test("legacy persisted drafts are sanitized before restoration", () => {
  sessionStorage.setItem("marzban-editor-drafts", JSON.stringify({
    legacy: { version: 1, savedAt: Date.now(), values: { username: "alice", proxies: { vless: { id: "legacy-secret" } } } },
  }));
  expect(readDraft("legacy")).toEqual({ username: "alice", proxies: { vless: {} } });
});
test("storage failure prevents reload until edits are saved or discarded", () => {
  const blockedStorage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  expect(saveDraft("core", { config: "draft" }, blockedStorage)).toBe(false); expect(canReloadWithoutLosingDrafts()).toBe(false);
  clearDraft("core"); expect(canReloadWithoutLosingDrafts()).toBe(true);
});
test("logout clears drafts and preserves harmless page preferences", () => {
  saveDraft("core", { config: "private" }); localStorage.setItem("marzban-num-users-per-page", "50");
  clearAuthState(); expect(readDraft("core")).toBeUndefined(); expect(localStorage.getItem("marzban-num-users-per-page")).toBe("50");
});

test("reload refreshes expired storage from the still-open editor snapshot", () => {
  setSystemTime(new Date("2026-01-01T00:00:00Z")); saveDraft("core", { config: "live edit" });
  setSystemTime(new Date("2026-01-01T07:00:00Z")); expect(readDraft("core")).toBeUndefined();
  expect(canReloadWithoutLosingDrafts()).toBe(true); expect(readDraft("core")).toEqual({ config: "live edit" });
});
