export const draftFlushEvent = "marzban:flush-drafts";
type Draft = { version: 1; savedAt: number; values: Record<string, unknown> };
const storageKey = "marzban-editor-drafts";
const maxAge = 6 * 60 * 60 * 1000;
const unsaved = new Set<string>();
type DraftStorage = Pick<Storage, "getItem" | "setItem">;
const activeDrafts = new Map<string, { values: Record<string, unknown>; storage?: DraftStorage }>();
const secretField = /password|secret|token|uuid|private.?key|credential|^psk$|short.?id/i;
function withoutSecrets(value: unknown, parents: string[] = []): unknown {
  if (Array.isArray(value)) return value.map((item) => withoutSecrets(item, parents));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !secretField.test(key) &&
          !(
            key.toLowerCase() === "id" &&
            parents.some((parent) => ["proxies", "clients"].includes(parent.toLowerCase()))
          ) &&
          !(key.toLowerCase() === "key" && parents.some((parent) => /tls|reality/i.test(parent))),
      )
      .map(([key, item]) => [key, withoutSecrets(item, [...parents, key])]),
  );
}
function getStorage(): DraftStorage | undefined {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
}
function readAll(storage: DraftStorage | undefined = getStorage()): Record<string, Draft> {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          ([, entry]) =>
            entry?.version === 1 &&
            Number.isFinite(entry.savedAt) &&
            Date.now() - entry.savedAt >= 0 &&
            Date.now() - entry.savedAt < maxAge &&
            entry.values &&
            typeof entry.values === "object" &&
            !Array.isArray(entry.values),
        )
        .map(([key, entry]) => [key, { ...entry, values: withoutSecrets(entry.values) as Record<string, unknown> }]),
    );
  } catch {
    return {};
  }
}
export function readDraft(key: string) {
  return readAll()[key]?.values;
}
export function saveDraft(
  key: string,
  values: Record<string, unknown>,
  storage: DraftStorage | undefined = getStorage(),
) {
  const safeValues = withoutSecrets(values) as Record<string, unknown>;
  activeDrafts.set(key, { values: safeValues, storage });
  if (!storage) {
    unsaved.add(key);
    return false;
  }
  try {
    storage.setItem(
      storageKey,
      JSON.stringify({ ...readAll(storage), [key]: { version: 1, savedAt: Date.now(), values: safeValues } }),
    );
    unsaved.delete(key);
    return true;
  } catch {
    unsaved.add(key);
    return false;
  }
}
export function clearDraft(key: string) {
  const drafts = readAll();
  delete drafts[key];
  unsaved.delete(key);
  activeDrafts.delete(key);
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(drafts));
  } catch {
    /* Browser storage may be blocked. */
  }
}
export function clearAllDrafts() {
  unsaved.clear();
  activeDrafts.clear();
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* Login must remain usable. */
  }
}
export function canReloadWithoutLosingDrafts() {
  for (const [key, { values, storage }] of activeDrafts) {
    if (!saveDraft(key, values, storage)) return false;
  }
  return unsaved.size === 0;
}
