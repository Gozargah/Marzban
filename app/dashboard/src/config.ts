declare global {
  var __MARZBAN_CONFIG__: { baseAPI: string } | undefined;
}

export const BASE_API: string =
  globalThis.__MARZBAN_CONFIG__?.baseAPI ??
  import.meta.env.VITE_BASE_API ??
  "/api/";
