export const queryKeys = {
  inbounds: ["inbounds"] as const,
  users: ["users"] as const,
  userList: (filters: Record<string, unknown>) => ["users", filters] as const,
  statistics: ["statistics-query-key"] as const,
  hosts: ["hosts"] as const,
  inboundsUsage: (start: string) => ["inbounds-usage", start] as const,
  core: ["core-settings"] as const,
};
