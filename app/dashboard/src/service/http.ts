import { FetchError, FetchOptions, $fetch as ohMyFetch } from "ohmyfetch";
import { getAuthToken } from "utils/authStorage";

export const $fetch = ohMyFetch.create({
  baseURL: import.meta.env.VITE_BASE_API,
});

export const fetcher = <T = any>(url: string, ops: FetchOptions<"json"> = {}) => {
  const token = getAuthToken();
  if (token) {
    ops["headers"] = {
      ...(ops?.headers || {}),
      Authorization: `Bearer ${getAuthToken()}`,
    };
  }
  return $fetch<T>(url, ops);
};

export const fetch = fetcher;

export type ErrorType<Error> = FetchError<{ detail: Error }>;
export type BodyType<BodyData> = BodyData;

type OvalFetcherParams = FetchOptions<"json"> & {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  params?: any;
  data?: FetchOptions<"json">["body"];
};
export const orvalFetcher = async <T>({ url, method, params, data: body }: OvalFetcherParams): Promise<T> => {
  return fetcher(url, {
    method,
    params,
    body,
  });
};

export default orvalFetcher;
