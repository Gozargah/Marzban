import { joinPaths } from "@remix-run/router";

import fa from "date-fns/locale/fa-IR";
import ru from "date-fns/locale/ru";
import zh from "date-fns/locale/zh-CN";
import dayjs from "dayjs";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpApi from "i18next-http-backend";
import { registerLocale } from "react-datepicker";
import { initReactI18next } from "react-i18next";

declare module "i18next" {
  interface CustomTypeOptions {
    returnNull: false;
  }
}

function syncLanguageMetadata() {
  const language = i18n.resolvedLanguage || i18n.language || "en";
  dayjs.locale(language);
  document.documentElement.lang = language;
  document.documentElement.dir = i18n.dir(language);
}

// Update the document before React's language subscribers render translated UI.
i18n.on("languageChanged", syncLanguageMetadata);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(HttpApi)
  .init(
    {
      debug: import.meta.env.NODE_ENV === "development",
      returnNull: false,
      fallbackLng: "en",
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
      load: "languageOnly",
      detection: {
        caches: ["localStorage", "sessionStorage", "cookie"],
      },
      backend: {
        loadPath: joinPaths([
          import.meta.env.BASE_URL,
          `statics/locales/{{lng}}.json`,
        ]),
      },
    },
    syncLanguageMetadata
  );

// DataPicker
registerLocale("zh-cn", zh);
registerLocale("ru", ru);
registerLocale("fa", fa);

export default i18n;
