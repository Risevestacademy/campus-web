"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { CampusAdmissionProvider } from "@/features/campus/session";
import { Toaster } from "@/shared/ui/toast";

// Query client, admission, and toasts for /campus/**, /preview and
// /session/refresh. The root layout keeps only theme behaviour.
export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so server renders never
  // share a cache between requests.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <CampusAdmissionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </CampusAdmissionProvider>
  );
}
