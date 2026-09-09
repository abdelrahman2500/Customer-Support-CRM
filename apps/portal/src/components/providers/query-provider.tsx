"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerQueryClient } from "@/lib/query-client-registry";
import { AuthRecoveryListener } from "./auth-recovery-listener";
import { NavigationOverlayListener } from "./navigation-overlay-listener";

/**
 * Story 53 — mirrors `apps/web/src/components/providers/query-provider.tsx`
 * exactly. Story 95 — also registers the client and mounts
 * `AuthRecoveryListener`, same as that file. UX audit — also mounts
 * `NavigationOverlayListener`, same as that file's own addition.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
    });
    registerQueryClient(client);
    return client;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthRecoveryListener />
      <NavigationOverlayListener />
      {children}
    </QueryClientProvider>
  );
}
