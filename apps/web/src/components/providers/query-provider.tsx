"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerQueryClient } from "@/lib/query-client-registry";
import { AuthRecoveryListener } from "./auth-recovery-listener";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
    });
    // Story 95 — registers the one app-wide client so a couple of call
    // sites outside this component (AuthRecoveryListener, WorkspaceNav's
    // sign-out) can clear cached data without each needing their own
    // QueryClientProvider ancestor. See `@/lib/query-client-registry`.
    registerQueryClient(client);
    return client;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthRecoveryListener />
      {children}
    </QueryClientProvider>
  );
}
