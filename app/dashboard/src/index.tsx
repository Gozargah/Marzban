import { ChakraProvider, localStorageManager } from "@chakra-ui/react";
import dayjs from "dayjs";
import Duration from "dayjs/plugin/duration";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import RelativeTime from "dayjs/plugin/relativeTime";
import Timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import "core/locales/i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "react-query";
import { theme } from "../chakra.config";
import App from "./app/App";
import "./index.scss";
import { queryClient } from "core/utils/react-query";
import { updateThemeColor } from "core/utils/themeColor";

dayjs.extend(Timezone);
dayjs.extend(LocalizedFormat);
dayjs.extend(utc);
dayjs.extend(RelativeTime);
dayjs.extend(Duration);

updateThemeColor(localStorageManager.get() || "light");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ChakraProvider>
  </React.StrictMode>
);
