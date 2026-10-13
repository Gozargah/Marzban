import { useSyncExternalStore } from "react";
import i18n from "@/locales/i18n";

function subscribe(onChange: () => void) {
  i18n.on("languageChanged", onChange);
  i18n.on("initialized", onChange);
  return () => {
    i18n.off("languageChanged", onChange);
    i18n.off("initialized", onChange);
  };
}

function getLanguage() {
  return i18n.resolvedLanguage || i18n.language || "en";
}

// A primitive snapshot makes locale changes reactive even with the React compiler.
export function useLocale() {
  const language = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return { language, direction: i18n.dir(language) };
}
