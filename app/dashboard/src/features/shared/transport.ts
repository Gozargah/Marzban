import type { FetchOptions } from "ofetch";
export type Transport = <T>(url: string, options?: FetchOptions<"json">) => Promise<T>;
