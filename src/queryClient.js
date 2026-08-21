import { QueryClient } from "@tanstack/react-query";

// Single shared client for the whole app. Do not create another QueryClient:
// nesting two QueryClientProviders means the inner one serves all components,
// so anything clearing the outer client silently does nothing.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 menit dianggap fresh → balik ke page tidak refetch
      staleTime: 5 * 60 * 1000,
      // cache di memori 30 menit
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (failureCount, err) => {
        if (err?.name === "CanceledError") return false;
        // A 401 will not fix itself by retrying; the session is gone.
        if (err?.response?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});
