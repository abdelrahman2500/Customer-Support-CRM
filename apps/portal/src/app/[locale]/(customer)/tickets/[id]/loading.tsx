import { TicketDetailSkeleton } from "@/components/tickets/ticket-detail-view";

/**
 * Story 97 — Loading & Skeleton UX. Mirrors
 * `apps/web/src/app/[locale]/(agent)/tickets/[id]/loading.tsx` exactly —
 * see that file's doc comment for the full rationale.
 */
export default function TicketDetailLoading() {
  return <TicketDetailSkeleton />;
}
