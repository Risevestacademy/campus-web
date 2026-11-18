import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function withQueryClient(ui: ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  );
}
