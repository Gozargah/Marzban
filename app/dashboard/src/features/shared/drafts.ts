export const draftFlushEvent = "marzban:flush-drafts";
type Draft = { version: 1; savedAt: number; values: Record<string, unknown> };
const storageKey = "marzban-editor-drafts";
const maxAge = 6 * 60 * 60 * 1000;
const unsaved = new Set<string>();
type DraftStorage = Pick<Storage, "getItem" | "setItem">;
const activeDrafts = new Map<string, { values: Record<string, unknown>; storage?: DraftStorage }>();
function getStorage(): DraftStorage | undefined {
  try { return sessionStorage; } catch { return undefined; }
}
function readAll(storage: DraftStorage | undefined = getStorage()): Record<string, Draft> {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => entry?.version === 1 && Number.isFinite(entry.savedAt) && Date.now() - entry.savedAt >= 0 && Date.now() - entry.savedAt < maxAge && entry.values && typeof entry.values === "object" && !Array.isArray(entry.values)));
  } catch { return {}; }
}
export function readDraft(key: string) { return readAll()[key]?.values; }
export function saveDraft(key: string, values: Record<string, unknown>, storage: DraftStorage | undefined = getStorage()) {
  activeDrafts.set(key, { values, storage });
  if (!storage) { unsaved.add(key); return false; }
  try {
    storage.setItem(storageKey, JSON.stringify({ ...readAll(storage), [key]: { version: 1, savedAt: Date.now(), values } }));
    unsaved.delete(key);
    return true;
  } catch { unsaved.add(key); return false; }
}
export function clearDraft(key: string) {
  const drafts = readAll(); delete drafts[key]; unsaved.delete(key); activeDrafts.delete(key);
  try { sessionStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { /* Browser storage may be blocked. */ }
}
export function clearAllDrafts() {
  unsaved.clear();
  activeDrafts.clear();
  try { sessionStorage.removeItem(storageKey); } catch { /* Login must remain usable. */ }
}
export function canReloadWithoutLosingDrafts() {
  for (const [key, { values, storage }] of activeDrafts) {
    if (!saveDraft(key, values, storage)) return false;
  }
  return unsaved.size === 0;
}
