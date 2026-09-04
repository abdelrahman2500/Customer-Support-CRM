import type { BadgeProps } from "@crm/ui";

/**
 * Story S-5 — the one place a ticket's domain state becomes a visual
 * variant, for the agent workspace.
 *
 * Both helpers below existed as byte-identical copies in three files —
 * `ticket-list-view.tsx`, `dashboard-view.tsx` and
 * `customer-detail-view.tsx` — each with a comment explaining that the
 * duplication was deliberate ("duplicated per-file rather than shared,
 * mirroring that exact same existing precedent"). Three copies of the same
 * four-branch map is the point at which that precedent stops paying for
 * itself: a new status, or a decision that CLOSED should read differently,
 * currently has to be found and changed in three places.
 *
 * This module lives in the app, not in `@crm/ui`, and that boundary is the
 * architectural point of the story:
 *
 *     domain status -> app mapping (here) -> shared Badge variant -> visuals
 *
 * `@crm/ui` owns the variant vocabulary and how each variant looks; it must
 * never learn what `IN_PROGRESS` is. The return type is `BadgeProps`'s own
 * variant union, so the two stay in step through the type system rather
 * than through a duplicated string literal.
 *
 * The mappings themselves are carried over unchanged — same variant for
 * same status, so nothing shifts visually.
 */
type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/**
 * Ticket status. Deliberately not all one colour: Story 98 introduced this
 * spread because status previously rendered as a uniform neutral `outline`
 * badge and carried no urgency signal at all.
 *
 * - `OPEN` -> `warning`: needs someone to pick it up.
 * - `IN_PROGRESS` -> `secondary`: owned, in hand, no action required.
 * - `RESOLVED` -> `success`: the good terminal state.
 * - `CLOSED` -> `outline`: terminal and archived; quietest of the four.
 */
export function ticketStatusBadgeVariant(status: string): BadgeVariant {
  if (status === "OPEN") return "warning";
  if (status === "RESOLVED") return "success";
  if (status === "CLOSED") return "outline";
  return "secondary"; // IN_PROGRESS
}

/**
 * Ticket priority. Only the top two priorities are coloured — `LOW` and
 * `MEDIUM` share the neutral `secondary` — because tinting all four would
 * spend the palette on the majority of rows and leave `URGENT` no louder
 * than the rest.
 *
 * Note this intentionally does *not* match `ticketStatusBadgeVariant`'s use
 * of `warning`: a `HIGH` priority and an `OPEN` status both read as amber
 * because both mean "attention", which is the semantic the S-1 `warning`
 * family exists to express.
 */
export function ticketPriorityBadgeVariant(priority: string): BadgeVariant {
  if (priority === "URGENT") return "destructive";
  if (priority === "HIGH") return "warning";
  return "secondary"; // LOW, MEDIUM
}
