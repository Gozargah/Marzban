import dayjs from "dayjs";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";

declare module "i18next" {
  interface CustomTypeOptions {
    returnNull: false;
  }
}

i18n.use(initReactI18next).init({
  debug: import.meta.env.NODE_ENV === "development",
  returnNull: false,
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
  },
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

dayjs.locale("en");

export default i18n;
