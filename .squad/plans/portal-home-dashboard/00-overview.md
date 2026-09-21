# portal-home-dashboard — plan overview

Entry point for the **portal-home-dashboard** feature. Stories execute in order by their `NN` prefix.

The Customer Portal's canonical landing page was never finished. `apps/portal/src/app/[locale]/(customer)/home/page.tsx` is 28 lines whose entire body is one sentence — under an i18n key literally named `placeholder` — and one link. Every authenticated customer lands there: `[locale]/page.tsx` redirects to it, `PortalHeader`'s `signedInAs` link points at it, and `(customer)/layout.tsx`'s SSR auth guard sends them there after login. This feature replaces it with a real one, using only capabilities that already exist.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 136 | [136-story-portal-home-dashboard.md](./136-story-portal-home-dashboard.md) | Portal Home — replaces the placeholder with a welcome block, a ticket panel (accurate `total` + the 5 most recent, status-badged, linking to existing detail routes), a knowledge-base panel (5 published articles), and navigation to the four existing destinations. Thin server page + client view, per-panel loading/empty/error, errors through the shared `Alert`. No backend change, no `PortalHeader` change, no new route, no new dependency. | — *(created via `--no-tracker`)* | Story 135 (`f9276c6`) |

## Dependency notes

- **Depends on Story 135** ([../portal-adopts-shared-ui-primitives/135-story-portal-adopts-shared-ui-primitives.md](../portal-adopts-shared-ui-primitives/135-story-portal-adopts-shared-ui-primitives.md)) as a hard constraint, not just sequencing: that story made `<Alert variant="destructive">` the portal's error surface and added the `RAW_ERROR_BOX` guard to `apps/portal/src/design-tokens.spec.ts`. Hand-rolling an error box here fails the portal test suite.
- **Consumes existing hooks read-only** — `useMyTicketsQuery` (Story 53 / PORTAL-1) and `usePublishedArticlesQuery` (Story 54 / 109 / S-8c). No hook, query key, or API client is modified.
- **Consumes `ticketStatusBadgeVariant`** (`apps/portal/src/lib/ticket-badges.ts`, Story S-5) read-only. That file's cross-app duplication is deliberate and documented; it is not touched.
- **No backend dependency.** No endpoint, controller, service, DTO, permission or migration.

## Scope decisions recorded during discovery

Two obvious-looking features were investigated against the code and **rejected**, so a later reader does not mistake them for oversights:

1. **Ticket status breakdown ("3 open, 2 resolved") — cannot be computed honestly.** `ListPortalTicketsQueryDto` accepts only `page`/`pageSize`, and `portal-tickets.controller.ts`'s own comment states *"no other filters exist for this list"*. With `DEFAULT_PAGE_SIZE` of 25, counting statuses from page 1 would be silently wrong for any customer with more than 25 tickets. Making it correct requires a new backend capability, which this story forbids. The panel therefore shows the envelope's accurate `total` (counts every row regardless of page) and the 5 most recent (the API already orders `createdAt desc`) — both correct by construction.
2. **Unread-notification tile — duplication.** `PortalHeader` already renders the unread count as a badge on the notifications nav link on every authenticated page (lines 85–86, 152–155). A second count on home repeats the same number centimetres below and adds a second subscriber to the same query for no new information.

Also settled during discovery: **content counts are fixed at 5 tickets and 5 articles**, sliced from the already-fetched first page (no extra request, no new parameter), as a bounded preview that never replaces the full listings; and **surfaces use the inline `rounded-md border border-rule bg-surface p-4` convention rather than `@crm/ui`'s `Card`**, which is exported but used by zero files in either app — adopting it here would be design-system work this story excludes.

## Preserved deliberately

- `apps/portal/src/components/portal/portal-header.tsx` and the existing portal navigation structure.
- `apps/portal/src/lib/ticket-badges.ts`.
- Zero raw physical-direction utilities in `apps/portal/src`, and no horizontal page overflow at 390px (the condition `article-list-view.tsx` records having measured).
- en/ar parity at 0 missing keys in either direction.
