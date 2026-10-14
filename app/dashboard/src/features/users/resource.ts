import type { FilterType } from "@/contexts/dashboard-context";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { User, UserCreate } from "types/User";
import { queryKeys } from "../shared/query-keys";
import type { Transport } from "../shared/transport";

export type UsersResponse = { users: User[]; total: number };
export function normalizeUserFilters(filters: FilterType) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}
/** The query cache is the sole owner of server data; callers retain their own form drafts. */
export function createUsersResource(client: QueryClient, request: Transport) {
  const invalidate = () => Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.users }),
    client.invalidateQueries({ queryKey: queryKeys.statistics }),
  ]);
  async function write<T>(url: string, method: "POST" | "PUT" | "DELETE", body?: UserCreate): Promise<T> {
    const result = await request<T>(url, { method, ...(body ? { body } : {}), retry: 0 });
    await invalidate();
    return result;
  }
  return {
    options(filters: FilterType) {
      const query = normalizeUserFilters(filters);
      return queryOptions({
        queryKey: queryKeys.userList(query),
        queryFn: ({ signal }) => request<UsersResponse>("/users", { query, signal, retry: 0 }),
        staleTime: 15_000, retry: false, refetchOnWindowFocus: false,
      });
    },
    refresh: () => client.invalidateQueries({ queryKey: queryKeys.users }),
    cancel: () => client.cancelQueries({ queryKey: queryKeys.users }),
    create: (body: UserCreate) => write<User>("/user", "POST", body),
    edit: (body: UserCreate) => write<User>(`/user/${body.username}`, "PUT", body),
    delete: (user: User) => write<void>(`/user/${user.username}`, "DELETE"),
    reset: (user: User) => write<void>(`/user/${user.username}/reset`, "POST"),
    revoke: (user: User) => write<User>(`/user/${user.username}/revoke_sub`, "POST"),
    resetAll: () => write<void>("/users/reset", "POST"),
  };
}
