import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import en from "../../public/statics/locales/en.json";
import fa from "../../public/statics/locales/fa.json";

const clients = new Set<QueryClient>();
export function cleanupQueryClients() {
  for (const client of clients) client.clear();
  clients.clear();
}

export function renderFrontend(ui: ReactNode, language = "en") {
  const i18n = createInstance();
  void i18n.init({ lng: language, fallbackLng: "en", initImmediate: false,
    resources: { en: { translation: en }, fa: { translation: fa } },
    interpolation: { escapeValue: false }, react: { useSuspense: false } });
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, networkMode: "always" },
  }});
  clients.add(client);
  return { ...render(<I18nextProvider i18n={i18n}><QueryClientProvider client={client}>{ui}</QueryClientProvider></I18nextProvider>), client, i18n };
}

// The real locale hook is exercised separately in the locale regression suite.
export const localeAdapter = { "@/hooks/use-locale": { useLocale: () => ({ language: "en", direction: "ltr" }) } };
