import { TicketDetailSkeleton } from "@/components/tickets/ticket-detail-view";

/**
 * Story 97 — Loading & Skeleton UX. Next.js shows this automatically
 * during the route transition itself (the RSC-payload/bundle fetch for
 * this segment), before `TicketDetailView` has even mounted to run its own
 * `ticketQuery.isLoading` branch — closing the "frozen page, no feedback"
 * gap Story 95's recon flagged between a list-row click and the detail
 * page's own skeleton appearing. Reuses the exact same skeleton shape
 * (one definition, two call sites) so there is no visible swap between
 * this and the view's own loading render.
 */
export default function TicketDetailLoading() {
  return <TicketDetailSkeleton />;
}
