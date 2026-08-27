> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-real-dashboard/agent-workspace-real-dashboard/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Real Agent Dashboard

- **Feature slug (folder under `plans/`):** `agent-workspace-real-dashboard`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Agent Workspace — Real Agent Dashboard
```

---

## Description

```text
Since Story 23, `/dashboard` has been a pure server-side redirect to `/tickets` — no dashboard component, widget, or logic exists behind it. A fresh, evidence-based requirements-traceability audit (covering Stories 01-27) found the Agent Dashboard requirement category at only ~20% coverage, and a frontend-first recon confirmed this redirect is the highest-severity workflow dead end in the entire workspace: an agent's only way to see "my own tickets" is to manually apply the "Assigned agent" filter on the branch-wide Ticket List, every session.

This story replaces the redirect stub with a real dashboard: the authenticated agent's own open tickets (OPEN/IN_PROGRESS), ordered so the most SLA-urgent work is immediately visible, using only the existing GET /tickets?assignedToUserId=<id> filter (Story 23) and the existing GET /auth/me endpoint — no new backend contract, no DB/migration/realtime/worker change.
```

---

## Acceptance criteria

```text
- An authenticated agent visiting /{locale}/dashboard sees a real dashboard, not a redirect.
- Loading, error (with retry), and empty states are implemented, following the same conventions already used elsewhere in the Agent Workspace (Skeleton, Alert, empty-state paragraph).
- The dashboard's tickets query is scoped to the authenticated agent via GET /tickets?assignedToUserId=<their own id> — never the unfiltered branch-wide list.
- RESOLVED/CLOSED tickets belonging to the agent are excluded from the populated list — this is a work queue, not a full history.
- Tickets are ordered breached-first, then soonest-remaining-target, then no-target-last, computed purely via the existing deriveSlaStatus helper — no new "at risk" threshold or business rule is introduced.
- Each row shows subject, customer name (resolved client-side via the existing useCustomersQuery pattern), status badge, priority badge, and the existing SLA presentation (breached badge / remaining-time text / "no SLA target").
- Clicking a row navigates to the existing tickets/{id} detail route; clicking the customer name navigates to the existing customers/{id} route, without also triggering the row's own navigation.
- An unauthenticated request to /{locale}/dashboard continues to redirect to /{locale}/login — the existing (agent)/layout.tsx guard is unchanged and still applies.
- No new backend endpoint, DTO, permission, Prisma model, migration, realtime event, or SLA/business rule is introduced.
- No protected file (RealtimeGateway, TicketRealtimeListener, BranchNotificationRealtimeListener, NotificationLog/listeners, any SLA-policies file, schema.prisma, migrations, TicketsController/TicketsService/DTOs, IdentityController) is modified.
- English and Arabic translations exist for every new string under a new `dashboard.*` namespace; RTL rendering is preserved.
- Component tests cover loading/error/empty/populated/scoping/exclusion/ordering/navigation/EN+AR, following the exact conventions already used by ticket-list-view.spec.tsx and customer-detail-view.spec.tsx.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `agent-workspace-ticket-operations-mvp` Story 23 (`GET /tickets?assignedToUserId=`, `GET /auth/me`, `useTicketsQuery`, `deriveSlaStatus`/`formatRemaining`, the `(agent)/layout.tsx` auth guard this story's redirect check mirrors).

- **Depends on code areas or other stories:**
  - `apps/web/src/app/[locale]/(agent)/dashboard/page.tsx` — replaced (was a redirect stub).
  - `apps/web/src/app/[locale]/(agent)/layout.tsx` — the private `fetchMe()` it previously defined inline is extracted (verbatim) to a shared helper this story's dashboard page also needs; behavior unchanged.
  - `apps/web/src/hooks/use-tickets.ts` (`useTicketsQuery`, `useCustomersQuery`) — reused unmodified.
  - `apps/web/src/lib/sla.ts` (`deriveSlaStatus`, `formatRemaining`) — reused unmodified, only its output is sorted, never approximated.
  - `apps/api/src/modules/tickets/**`, `apps/api/src/modules/identity/**` — read-only dependency (`GET /tickets`, `GET /auth/me`), not modified.

## Extra notes (optional)

- This story was selected via a "Frontend-First Next-Story Recon" performed after a full 12-category Core-Requirements traceability audit (post Story 27), which found `/dashboard` to be the single highest-severity, zero-new-backend-required workflow gap in the workspace.
- **Numbering**: NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` (Story 24 was implemented directly from a user-supplied specification, no `.squad` representation exists or is fabricated for it) — unchanged by this story. Story 28, by contrast, follows the normal recon → intake → plan → implement SquadKit workflow and is fully represented here.
- SLA-urgency ordering (breached-first, then soonest-remaining) is a presentation-only sort over `deriveSlaStatus`'s already-computed output — it deliberately does not reproduce or approximate the backend's internal "at risk" warning threshold, consistent with `sla.ts`'s own documented design constraint from Story 23.

## Technical hints (optional)

- `ListTicketsQueryDto.assignedToUserId` (already validated as `@IsUUID()`, already consumed by `TicketListView`'s "Assigned agent" filter) is the only backend contract this story needs — call it with the authenticated user's own id instead of an agent-picked filter value.
- `ListTicketsQueryDto.status` only accepts one enum value at a time — fetching "OPEN or IN_PROGRESS" in one server call isn't possible; the dashboard fetches the unfiltered-by-status, assignedToUserId-scoped result and excludes RESOLVED/CLOSED client-side, mirroring the exact "fetch the already-scoped, unpaginated result and refine client-side" precedent Story 27 established for `CustomerDetailView`'s Related Tickets section.
- `AuthenticatedUser.id` (`packages/shared/src/auth.ts`) is exactly the value needed; `(agent)/layout.tsx` already resolves it server-side via a private `fetchMe()` — this story extracts that function verbatim into a shared helper so the new dashboard page doesn't duplicate an auth-sensitive fetch.
- A small presentational helper (`priorityBadgeVariant`) is duplicated locally rather than shared — the same convention `customer-detail-view.tsx` (Story 27) already established for this exact helper, in place of a premature shared-component extraction.

## Out of scope

- Customer editing, contact CRUD, customer interaction history, notes/attachments.
- Admin UI (users/roles/permissions/audit logs/system configuration), SLA policy configuration UI.
- Notification center/history, agent presence, team collaboration, tasks/reminders, quick replies.
- Any new "at risk" (as distinct from "breached"/"on-track with remaining time") SLA concept.
- Any filter/sort/search/pagination UI on the dashboard itself.
- Knowledge Base, AI, Customer Portal, Reporting, Integrations, generalized `AutomationRule` engine.
