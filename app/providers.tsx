"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { Toaster } from "@/shared/ui/toast";

// Query client and toasts for routes with mutations: /campus/**, /preview and
// /session/refresh. The root layout keeps only theme behaviour.
export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so server renders never
  // share a cache between requests.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
