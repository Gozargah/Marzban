import { FetchOptions, $fetch as ohMyFetch } from "ofetch";

export const $fetch = ohMyFetch.create({
  baseURL: import.meta.env.VITE_BASE_API,
  // Send the httpOnly session cookie; "include" also covers the dev server
  // talking to the API on another port.
  credentials: "include",
});

export const fetcher = <T = any>(
  url: string,
  ops: FetchOptions<"json"> = {}
) => {
  return $fetch<T>(url, ops);
};

export const fetch = fetcher;
