import { test, expect } from "bun:test";
import { createInstance } from "i18next";
import { act, renderHook } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";

test("locale hook reacts to language changes and falls back to the displayed language", async () => {
  const i18n = createInstance();
  await i18n.init({ lng: "en", fallbackLng: "en", initImmediate: false, resources: {
    en: { translation: { hello: "Hello" } }, fa: { translation: { hello: "سلام" } },
  } });
  const { useLocale } = loadSource<typeof import("../../src/hooks/use-locale")>("hooks/use-locale.ts", { "@/locales/i18n": i18n });
  const { result, unmount } = renderHook(() => useLocale());
  expect(result.current).toEqual({ language: "en", direction: "ltr" });
  await act(async () => { await i18n.changeLanguage("fa"); });
  expect(result.current).toEqual({ language: "fa", direction: "rtl" });
  await act(async () => { await i18n.changeLanguage("ar"); });
  expect(result.current).toEqual({ language: "en", direction: "ltr" });
  unmount();
});
