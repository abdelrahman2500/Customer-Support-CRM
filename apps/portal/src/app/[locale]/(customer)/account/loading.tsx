import { RouteLoadingSkeleton } from "@crm/ui";

/**
 * Global Navigation Loading — this route segment has no page-specific
 * skeleton of its own, so it renders the shared generic one, mirroring
 * `notifications/loading.tsx` exactly.
 */
export default function Loading() {
  return <RouteLoadingSkeleton />;
}
