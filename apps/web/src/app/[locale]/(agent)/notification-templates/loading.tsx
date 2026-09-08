import { RouteLoadingSkeleton } from "@crm/ui";

/**
 * Global Navigation Loading — this route segment has no page-specific
 * skeleton of its own (unlike `tickets/[id]`, `customers/[id]` and
 * `knowledge-base/[id]`'s Story 97 skeletons), so it renders the shared
 * generic one instead. See `RouteLoadingSkeleton`'s own doc comment for why.
 */
export default function Loading() {
  return <RouteLoadingSkeleton />;
}
