import { FetchOptions, $fetch as ohMyFetch } from "ofetch";

export const $fetch = ohMyFetch.create({
  baseURL: import.meta.env.VITE_BASE_API,
  timeout: 15_000,
});

let inMemoryCsrfToken: string | undefined;
export const setCsrfToken = (token?: string) => {
  inMemoryCsrfToken = token;
};

async function getCsrfToken(): Promise<string | undefined> {
  if (inMemoryCsrfToken) return inMemoryCsrfToken;
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("marzban_csrf="))
    ?.slice("marzban_csrf=".length);
  if (cookie) return decodeURIComponent(cookie);
  try {
    const response = await $fetch<{ csrf_token: string }>("/admin/session/csrf", { credentials: "include", retry: 0 });
    inMemoryCsrfToken = response.csrf_token;
    return inMemoryCsrfToken;
  } catch {
    return undefined;
  }
}

export const fetcher = async <T = any>(url: string, ops: FetchOptions<"json"> = {}) => {
  const headers = new Headers(ops.headers);
  const method = (ops.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !url.endsWith("/admin/session")) {
    const csrf = await getCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  return $fetch<T>(url, {
    ...ops,
    credentials: "include",
    timeout: ops.timeout ?? (method !== "GET" ? 60_000 : 15_000),
    headers: Object.fromEntries(headers.entries()),
  });
};

export const fetch = fetcher;
