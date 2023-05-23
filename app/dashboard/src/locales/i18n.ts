import { joinPaths } from "@remix-run/router";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpApi from "i18next-http-backend";
import { initReactI18next } from "react-i18next";
import { registerLocale } from  "react-datepicker";
import es from 'date-fns/locale/es';
import zh from 'date-fns/locale/zh-CN'

declare module "i18next" {
  interface CustomTypeOptions {
    returnNull: false;
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(HttpApi)
  .init({
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
      loadPath: joinPaths([import.meta.env.BASE_URL, `locales/{{lng}}.json`]),
    },
  }, function(err, t) {
    dayjs.locale(i18n.language);
  });

i18n.on("languageChanged", (lng) => {
  dayjs.locale(lng);
});

// DataPicker
registerLocale('es', es);
registerLocale('zh-cn', zh);

export default i18n;
