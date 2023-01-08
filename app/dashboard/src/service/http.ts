import { $fetch as ohMyFetch, FetchOptions } from "ohmyfetch";
import { getAuthToken } from "utils/authStorage";

export const $fetch = ohMyFetch.create({
  baseURL: import.meta.env.VITE_BASE_API,
});

export const fetcher = (url: string, ops: FetchOptions<"json"> = {}) => {
  const token = getAuthToken();
  if (token) {
    ops["headers"] = {
      ...(ops?.headers || {}),
      Authorization: `Bearer ${getAuthToken()}`,
    };
  }
  return $fetch(url, ops);
};

export const fetch = fetcher;
