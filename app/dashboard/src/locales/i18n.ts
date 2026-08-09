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
                // Bust the browser cache of the locale JSONs after key changes.
                // Bump this on every locale edit: the files carry no
                // Cache-Control, i18next fetches them by XHR, and an XHR is not
                // covered by the browser's hard-reload cache bypass — a stale
                // copy otherwise survives until the heuristic freshness expires.
                queryStringParams: { v: "redesign-1" },
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