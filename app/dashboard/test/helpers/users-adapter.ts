/** Only feature-view tests use this adapter. Real cache/cancellation behavior is tested via resources. */
export function usersAdapter(store: any) {
  return { "@/features/users/queries": { useUsersQuery: () => {
    const users = store((state: any) => state.users);
    const loading = store((state: any) => state.loading);
    const usersError = store((state: any) => state.usersError);
    const refetchUsers = store((state: any) => state.refetchUsers);
    return { users, loading, usersError, refetchUsers, initialLoading: loading && !users.users.length, isPlaceholderData: false, dataUpdatedAt: 0 };
  } } };
}
