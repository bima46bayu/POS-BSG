// src/lib/queryClient.js
import { QueryClient } from "@tanstack/react-query";

// Single instance dipakai di seluruh app
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});
