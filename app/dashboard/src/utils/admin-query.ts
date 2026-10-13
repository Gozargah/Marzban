import { queryOptions } from "@tanstack/react-query";
import { fetch } from "service/http";
import type { UserApi } from "types/User";

/** Share the authenticated admin read between routing and the dashboard header. */
export const adminQueryOptions = queryOptions({
  queryKey: ["user"],
  queryFn: ({ signal }) => fetch<UserApi>("/admin", { signal, retry: 0 }),
  staleTime: 60_000,
  retry: false,
});
