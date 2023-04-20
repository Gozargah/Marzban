import { ChakraProvider, localStorageManager } from "@chakra-ui/react";
import React from "react";
import ReactDOM from "react-dom/client";
import { SWRConfig } from "swr";
import { theme } from "../chakra.config";
import App from "./App";
import "index.scss";
import "locales/i18n"
import { fetcher } from "service/http";
import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import Timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import RelativeTime from "dayjs/plugin/relativeTime";
import { updateThemeColor } from "utils/themeColor";

dayjs.extend(Timezone);
dayjs.extend(LocalizedFormat);
dayjs.extend(utc);
dayjs.extend(RelativeTime);

updateThemeColor(localStorageManager.get() || "light");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <SWRConfig
        value={{
          fetcher,
          revalidateIfStale: false,
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
        }}
      >
        <App />
      </SWRConfig>
    </ChakraProvider>
  </React.StrictMode>
);
