import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Retry up to 3 times on transient failures (skip 4xx client errors).
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (typeof status === "number" && status >= 400 && status < 500) return false;
          return failureCount < 3;
        },
        // Exponential backoff: 1s, 2s, 4s (capped at 30s).
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
        staleTime: 30_000,
      },
      mutations: {
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (typeof status === "number" && status >= 400 && status < 500) return false;
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
