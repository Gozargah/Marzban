export const queryKeys = {
  inbounds: ["inbounds"] as const,
  users: ["users"] as const,
  userList: (filters: Record<string, unknown>) => ["users", filters] as const,
  statistics: ["statistics-query-key"] as const,
  hosts: ["hosts"] as const,
  core: ["core-settings"] as const,
};
