import { ChakraProvider } from "@chakra-ui/react";
import React from "react";
import ReactDOM from "react-dom/client";
import { SWRConfig } from "swr";
import { theme } from "../chakra.config";
import App from "./App";
import "./index.css";
import { fetcher } from "./service/http";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <SWRConfig
        value={{
          // provider: () => new Map(),
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
