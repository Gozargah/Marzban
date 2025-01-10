import { defineConfig } from 'orval'

export default defineConfig({
  app: {
    output: {
      client: 'react-query',
      target: './src/service/api/index.ts',
      mode: 'single',
      clean: true,
      prettier: true,
      tslint: true,
      headers: false,
      override: {
        mutator: {
          path: './src/service/http.ts',
          name: 'orvalFetcher',
        },
      },
    },
    input: {
      target: `http://127.0.0.1:${process.env.UVICORN_PORT}/openapi.json`,
    },
  },
})
