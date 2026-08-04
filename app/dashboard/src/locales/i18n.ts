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
                // Unlike the JS bundle (fingerprinted filename, safe to cache forever),
                // this file's name never changes between builds, so browsers/proxies can
                // keep serving an old cached copy indefinitely after a deploy -- newly
                // added translation keys then show up as raw "namespace.key" text. This
                // query param changes once per page load, forcing a fresh fetch every time.
                queryStringParams: { v: String(Date.now()) },
            },
        },
        function (err, t) {
            dayjs.locale(i18n.language);
        }
    );

i18n.on("languageChanged", (lng) => {
    dayjs.locale(lng);
});

// DataPicker
registerLocale("zh-cn", zh);
registerLocale("ru", ru);
registerLocale("fa", fa);

export default i18n;