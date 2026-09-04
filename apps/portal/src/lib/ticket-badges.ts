import type { BadgeProps } from "@crm/ui";

/**
 * Story S-5 — the one place a ticket's domain state becomes a visual
 * variant, for the customer portal.
 *
 * S-2 replaced this app's hand-rolled `statusPillClassName` with a mapping
 * onto `@crm/ui`'s semantic `Badge` variants, but left a copy in each of
 * `ticket-list-view.tsx` and `ticket-detail-view.tsx`. This is that single
 * copy.
 *
 * Same boundary as the agent workspace's own `ticket-badges.ts`:
 *
 *     domain status -> app mapping (here) -> shared Badge variant -> visuals
 *
 * The mapping is intentionally identical to the agent workspace's, because
 * a customer and an agent looking at the same ticket must see the same
 * state rendered the same way. It is duplicated across the two apps rather
 * than shared, because sharing it needs a domain package that does not
 * exist yet and that S-5 is not the story to invent — `@crm/ui` holds
 * primitives and must not learn what a ticket status is. The two copies are
 * pinned together by the browser verification, which asserts the portal and
 * the workspace render the same variant for the same status.
 */
type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/** See `apps/web/src/lib/ticket-badges.ts` for why each status maps as it
 * does. The portal shows the same four statuses, read-only. */
export function ticketStatusBadgeVariant(status: string): BadgeVariant {
  if (status === "OPEN") return "warning";
  if (status === "RESOLVED") return "success";
  if (status === "CLOSED") return "outline";
  return "secondary"; // IN_PROGRESS
}
