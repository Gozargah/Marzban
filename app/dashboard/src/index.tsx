import { ChakraProvider, localStorageManager } from "@chakra-ui/react";
import dayjs from "dayjs";
import Duration from "dayjs/plugin/duration";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import RelativeTime from "dayjs/plugin/relativeTime";
import Timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import "locales/i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "react-query";
import { queryClient } from "utils/react-query";
import { updateThemeColor } from "utils/themeColor";
import { theme } from "../chakra.config";
import { AccentColorProvider } from "contexts/AccentColorContext";
import App from "./App";
import "index.scss";

dayjs.extend(Timezone);
dayjs.extend(LocalizedFormat);
dayjs.extend(utc);
dayjs.extend(RelativeTime);
dayjs.extend(Duration);

updateThemeColor(localStorageManager.get() || "dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <AccentColorProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AccentColorProvider>
    </ChakraProvider>
  </React.StrictMode>
);
