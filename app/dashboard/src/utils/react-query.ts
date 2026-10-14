import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    // Explicit writes fail immediately when offline rather than running later without the user's context.
    mutations: { retry: false, networkMode: "always" },
  },
});
