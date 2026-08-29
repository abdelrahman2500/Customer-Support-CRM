# Story 56 — Reporting & Analytics Foundation

## Prerequisites

- `ticketing` Story 07: `Ticket` (`status`, `priority`, `branchId`, `createdAt`).
- `sla-policy-foundation`/`sla-breach-escalation`: `SlaTicketTarget` (one per ticket a policy matched) and `SlaEscalation` (`targetType: "response" | "resolution"`, one row per real breach event).
- `customer-portal-ticket-csat-feedback` Story 55: `TicketCsatResponse` (`rating`, one per ticket).

---

## Story Goal

Establish the Reporting & Analytics domain's first read surface: three branch-scoped, read-only aggregate endpoints computed via direct Prisma queries over already-modeled data — ticket volume by status, SLA compliance rate, and CSAT average — plus a new Agent Workspace "Reports" page. Closes the gap between `docs/architecture/03-domain-boundaries.md`'s Reporting row (still fully unimplemented) and the data Stories 07/10/17/55 already capture for it.

**Not in scope** (mirrors `docs/architecture/08-supporting-domains.md`'s own phasing — "Reporting starts with direct queries and materialized views... deferred until query load... outgrow Postgres"): a new `reporting` Prisma schema/model; materialized views; the `reports-refresh` worker job; date-range filtering/historical trends; ticket-aging buckets; per-agent performance breakdowns; charts/graphs (no charting library exists anywhere in this codebase today — introducing one is a bigger, separate decision); any export/download capability.

---

## Context — Read These Files First

1. `docs/architecture/08-supporting-domains.md` — "Reporting & Analytics (high level)": the four named dimensions (ticket volume/aging, SLA, agent performance, CSAT) and the "direct queries first" phasing this story follows.
2. `apps/api/prisma/schema.prisma` — `Ticket` (no `resolvedAt` column — noted, not fixed, see Design decision 4), `SlaTicketTarget`, `SlaEscalation`, `TicketCsatResponse` — the exact fields this story's queries read.
3. `apps/api/src/modules/admin/audit-logs.{controller,service}.ts` — the exact "one module, `TenantContext.requireBranchScope()`, one permission, no pagination" shape this story's new module mirrors.
4. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG`/`ROLE_GRANTS` — the exact place the new `report:read` key is added (granted to `SuperAdmin` only, via the existing wildcard spread; `Agent` starts with none, same as every other admin-ish resource here).
5. `apps/web/src/components/audit-logs/audit-log-view.tsx` + `apps/web/src/lib/audit-logs-api.ts` + `apps/web/src/hooks/use-audit-logs.ts` — the exact "own API file, own hook file, forbidden-vs-generic-error" convention this story's new Reports screen mirrors.
6. `apps/web/src/components/workspace/workspace-nav.tsx` — the fixed-order, no-client-side-permission-gating nav list this story appends to.

---

## Design decisions

1. **No new Prisma schema/model, no migration.** Every input table already exists; this is a pure new `ReportingModule` (service + controller) over existing Prisma delegates (`groupBy`/`aggregate`/`count`/`findMany` with `distinct`). Matches the architecture doc's own "direct queries" starting point.
2. **Three separate endpoints, not one combined payload** — `GET /reports/ticket-volume`, `GET /reports/sla-compliance`, `GET /reports/csat` — mirrors this codebase's existing convention of one focused endpoint per concern (e.g. `sla-target`/`sla-escalations`/`notes`/`csat` as separate ticket sub-resources) rather than inventing a new "dashboard payload" shape.
3. **New permission `report:read`** — added to `PERMISSION_CATALOG`, granted to `SuperAdmin` only via the existing wildcard (`Agent: []`, matching `audit:read`/`sla:read`'s own initial-grant precedent). No dedicated Reporting role — out of scope for a foundation story.
4. **SLA compliance is computed from `SlaEscalation`, not a `resolvedAt` timestamp** — `Ticket` has no `resolvedAt` column (confirmed via recon), so "time to resolution" reporting is not possible yet and is explicitly deferred. Compliance here means: of tickets that had an `SlaTicketTarget` (a policy matched), what fraction never received a `resolution`-type `SlaEscalation` (never breached). `complianceRate` is `null` when there is no data yet (`totalWithTarget === 0`), never a misleading `0`/`100`.
5. **Breached-ticket count uses `distinct: ["ticketId"]` on `SlaEscalation`**, not a raw row count — `SlaEscalation` has `@@unique([ticketId, targetType, targetAt])`, so a re-categorized ticket could in principle carry more than one `resolution`-type escalation row across different target windows; counting distinct tickets avoids double-counting.
6. **CSAT summary scopes through the `Ticket` relation** (`ticketCsatResponse.aggregate({ where: { ticket: { branchId } } })`), not a denormalized `branchId` column on `TicketCsatResponse` — mirrors `SlaEscalationsService`'s existing "scope through the parent Ticket" pattern (`TicketCsatResponse` has no `branchId` column of its own, by design, same as `TicketNote`).
7. **No charts** — three plain stat-tile cards (count/rate/average), consistent with every existing data screen in `apps/web` (tables, `Badge`, `Skeleton`, `Alert` — zero charting precedent anywhere in this codebase). Introducing a charting dependency is a separate, larger decision left to a future story if there's real demand for it.
8. **Nav entry appended last**, same as every prior addition (Story 51's own doc comment in `workspace-nav.tsx`) — no client-side permission gating (matches that file's own "no such pattern exists" precedent); a caller without `report:read` sees the existing 403-vs-generic-error split already used by `AuditLogView`.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/seed.ts`** — add `"report:read"` to `PERMISSION_CATALOG`. No `ROLE_GRANTS` change needed (`SuperAdmin: PERMISSION_CATALOG` already includes it via the spread; `Agent: []` is unchanged).
2. **New `apps/api/src/modules/reporting/reporting.service.ts`**:
   - `TicketVolumeByStatus` (`status`, `count`), `SlaComplianceSummary` (`totalWithTarget`, `breachedCount`, `compliantCount`, `complianceRate: number | null`), `CsatSummary` (`responseCount`, `averageRating: number | null`) interfaces.
   - `getTicketVolumeByStatus()`: `this.tenantContext.requireBranchScope()`, then `prisma.ticket.groupBy({ by: ["status"], where: { branchId }, _count: { _all: true } })`, mapped to `TicketVolumeByStatus[]` (only statuses with at least one ticket appear — no zero-padding, same as every other list endpoint here).
   - `getSlaCompliance()`: `totalWithTarget = prisma.slaTicketTarget.count({ where: { ticket: { branchId } } })`; distinct breached ticket ids via `prisma.slaEscalation.findMany({ where: { branchId, targetType: "resolution" }, select: { ticketId: true }, distinct: ["ticketId"] })`; `compliantCount = totalWithTarget - breachedCount`; `complianceRate = totalWithTarget > 0 ? compliantCount / totalWithTarget : null`.
   - `getCsatSummary()`: `prisma.ticketCsatResponse.aggregate({ where: { ticket: { branchId } }, _avg: { rating: true }, _count: { _all: true } })`, mapped to `{ responseCount, averageRating }`.
3. **New `apps/api/src/modules/reporting/reporting.controller.ts`** — `@Controller("reports")`, three `@Get()` routes (`ticket-volume`, `sla-compliance`, `csat`), all `@RequirePermissions("report:read")`.
4. **New `apps/api/src/modules/reporting/reporting.module.ts`** — `controllers: [ReportingController]`, `providers: [ReportingService, TenantContext]` (mirrors `NotificationsModule`'s own provider list shape).
5. **`apps/api/src/app.module.ts`** — import `ReportingModule`.
6. **Tests** — see Test Plan.

### Frontend

7. **New `apps/web/src/lib/reporting-api.ts`** — own file (mirrors `audit-logs-api.ts`'s "distinct domain, own file" convention): `TicketVolumeByStatus`, `SlaComplianceSummary`, `CsatSummary` types + `getTicketVolumeByStatus`/`getSlaCompliance`/`getCsatSummary`.
8. **New `apps/web/src/hooks/use-reporting.ts`** — `useTicketVolumeQuery`/`useSlaComplianceQuery`/`useCsatSummaryQuery`, no `staleTime` override (mirrors `useAuditLogsQuery`).
9. **New `apps/web/src/components/reporting/reports-view.tsx`** — three stat-tile cards, mirroring `AuditLogView`'s loading/forbidden/generic-error split per query (each card independently loading/erroring — one query's failure never blocks the other two's render).
10. **New `apps/web/src/app/[locale]/(agent)/reports/page.tsx`** — one-line pass-through, mirrors `audit-logs/page.tsx`.
11. **`apps/web/src/components/workspace/workspace-nav.tsx`** — append `{ href: "reports", labelKey: "nav.reports" }` as the new last entry.
12. **i18n** — `apps/web/messages/{en,ar}.json`: `workspace.nav.reports` + a new top-level `reporting` namespace (title/forbidden/error/retry per card + the three cards' own labels).
13. **Tests** — see Test Plan.

---

## API contract

- `GET /reports/ticket-volume` — `report:read` — `[{ status, count }]`, branch-scoped, only non-zero statuses.
- `GET /reports/sla-compliance` — `report:read` — `{ totalWithTarget, breachedCount, compliantCount, complianceRate }`, branch-scoped; `complianceRate: null` when `totalWithTarget` is `0`.
- `GET /reports/csat` — `report:read` — `{ responseCount, averageRating }`, branch-scoped; `averageRating: null` when `responseCount` is `0`.

## Tests

**Backend unit** (new `reporting.service.spec.ts`): `getTicketVolumeByStatus` groups correctly, scoped by branch; `getSlaCompliance` — zero-target `null` rate, mixed breached/compliant math, distinct-ticket-id dedup; `getCsatSummary` — zero-response `null` average, correct aggregate mapping.

**Backend e2e** (new `reporting.e2e-spec.ts`): 401 unauthenticated; 403 for an Agent lacking `report:read`; real ticket-volume counts after creating tickets in known statuses; real SLA compliance after a real `sla.breached` emission (mirrors `sla-escalations.e2e-spec.ts`'s own real-event-emission precedent); real CSAT average after submitting portal feedback (Story 55's own flow); branch isolation (a second branch's data never appears).

**Frontend component** (`reports-view.spec.tsx`): loading/forbidden/generic-error/populated states per card, independently.

## Regression requirements

Every existing test suite remains green, unweakened.

## Migration requirements

None — no schema change.

## Security risks/mitigations

- **Branch isolation**: every query scoped via `TenantContext.requireBranchScope()`, identical mechanism to every other branch-scoped read in this codebase.
- **New permission surface**: `report:read` gates all three routes; no existing permission's meaning changes.
- **No new external exposure**: read-only, no export/download, no PII beyond what `ticket:read`/`sla:read`/CSAT already expose individually.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `ReportingModule` exists, wired into `AppModule`; no schema/migration change.
- [ ] `report:read` added to the permission catalog; `SuperAdmin` has it via the existing wildcard, `Agent` does not by default.
- [ ] Three endpoints exist, permission-correct, branch-scoped, with `null`-not-`0`/`100` handling for the empty-data case.
- [ ] New Agent Workspace "Reports" page renders all three cards independently (one card's error never blocks another's data).
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- New `reporting` Prisma schema, materialized views, `reports-refresh` worker job, date-range filtering, ticket-aging buckets, per-agent performance breakdown, charts/graphs, export/download.
- Any README change.
