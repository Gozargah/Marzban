import { defineConfig } from "orval";

export default defineConfig({
  Marzban: {
    output: {
      mock: false,
      clean: true,
      mode: "tags-split",
      client: "react-query",
      schemas: "src/api/models",
      target: "src/api/endpoints",
      override: {
        useTypeOverInterfaces: true,
        operationName: (operation) => {
          const summery = String(operation.summary ?? "");
          const camelize = summery.charAt(0).toLowerCase() + summery.slice(1);
          return [camelize, "API"].join(" ");
        },
      },
    },
    input: {
      target: "./src/api/schema.json",
    },
  },
});
