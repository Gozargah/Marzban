import { useDashboard } from "@/contexts/dashboard-context";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usersResource } from "./api";
const emptyUsers = { users: [], total: 0 };
export function useUsersQuery() {
  const filters = useDashboard((state) => state.filters);
  const query = useQuery({ ...usersResource.options(filters), placeholderData: keepPreviousData });
  return {
    ...query,
    users: query.data ?? emptyUsers,
    loading: query.isFetching || query.isPaused,
    initialLoading: query.isPending,
    usersError: query.isError,
    refetchUsers: () => { void query.refetch(); },
  };
}
