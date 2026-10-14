import { FetchOptions, $fetch as ohMyFetch } from "ofetch";
import { getAuthToken } from "utils/authStorage";

export const $fetch = ohMyFetch.create({
  baseURL: import.meta.env.VITE_BASE_API,
  timeout: 15_000,
});

export const fetcher = <T = any>(
  url: string,
  ops: FetchOptions<"json"> = {}
) => {
  const token = getAuthToken();
  const headers = new Headers(ops.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return $fetch<T>(url, { ...ops, timeout: ops.timeout ?? (ops.method && ops.method.toUpperCase() !== "GET" ? 60_000 : 15_000), headers: Object.fromEntries(headers.entries()) });
};

export const fetch = fetcher;
