# Story 49 — Agent Workspace: SLA Escalation Visibility

## Prerequisites

- `sla-breach-escalation` Story 17: the `SlaEscalation` Prisma model and `sla-escalation.listener.ts`, its only production writer.
- `sla-timer-detection-foundation` Story 15: `SlaTargetsController`/`SlaTargetsService` — the exact structural template this story's new controller/service mirror (a second controller in the `sla-policies` module, deliberately routed under `/tickets`).
- `ticket-history-timeline-completion` Story 21: `useTicketHistoryQuery`/the History card's exact loading/error/empty/populated JSX shape, mirrored here.
- `agent-workspace-user-profile-correction` Story 48: most recently completed story; confirms the identity/admin arc is finished and this story deliberately does not touch it.

---

## Story Goal

Let an agent/admin (holding `sla:read`) see a ticket's SLA escalation history — which target type breached and when — via a new `GET /tickets/:id/sla-escalations` endpoint, surfaced as a new card on the existing Ticket Detail screen. `SlaEscalation` rows have existed and been written correctly since Story 17; this story closes the "we generate this data but nobody can see it" gap, confirmed explicitly by Story 17's own e2e-spec doc comment: *"no HTTP endpoint exposes `SlaEscalation` rows, by design — this story adds none."*

**Not in scope**: any change to SLA breach detection or escalation-creation logic; any branch-wide/cross-ticket escalations dashboard; reporting/analytics; ticket messaging/comments; any identity/admin work (Stories 45–48, untouched); `createUser`'s known, separately-disclosed branch-scoping inconsistency (a different candidate, not this story's job).

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `SlaEscalation` (lines 394-406): `id`, `ticketId`, `branchId` (exists directly on the row, not only via the `ticket` relation), `targetType` (plain `String`, runtime values are lowercase `"response"`/`"resolution"`), `targetAt`, `escalatedAt`, unique on `[ticketId, targetType, targetAt]` (permits multiple rows per ticket — the reason this is a list endpoint, not singular like `sla-target`). Its own doc comment confirms it is append-only, never updated after creation.
2. `apps/api/src/modules/sla-policies/sla-targets.controller.ts` + `sla-targets.service.ts` — the exact structural template: a second controller in this module, `@Controller("tickets")`, `@Get(":id/sla-target")`, `@RequirePermissions("sla:read")`, scoping via `TenantContext.requireBranchScope()` + `prisma.ticket.findFirst({ where: { id: ticketId, branchId } })` → `NotFoundException("Ticket not found")` if null.
3. `apps/api/src/modules/notifications/notifications.service.ts` / `apps/api/src/modules/admin/audit-logs.service.ts` — the "list read, `orderBy: desc`, empty array (not 404) when there's no data" precedent this story's service mirrors for the "no escalations yet" case.
4. `apps/api/src/modules/sla-policies/sla-escalation.listener.ts` and `apps/api/test/sla-breach-escalation.e2e-spec.ts` — confirms the exact write shape (`{ ticketId, branchId, targetType, targetAt }`, `escalatedAt` via Prisma `@default(now())`) and the established, working e2e technique for producing a real escalation row: emit `SLA_BREACHED_EVENT` directly on the real `EventEmitter2`, no fake timers, no direct Prisma seeding.
5. `apps/web/src/components/tickets/ticket-detail-view.tsx` — the History card's exact loading (`Skeleton`)/error (`Alert variant="destructive"`)/empty (`<p>`)/populated (`<ol>` of `<li>`) states — the structural template for the new card.
6. `apps/web/src/lib/tickets-api.ts` / `apps/web/src/hooks/use-tickets.ts` — where `getTicketSlaTarget`/`useTicketSlaTargetQuery` and `getTicketHistory`/`useTicketHistoryQuery` already live (ticket-scoped reads, regardless of backend module ownership) — the new escalations read follows this exact placement, not `sla-policies-api.ts`.
7. `apps/web/src/components/notifications/notification-history-view.tsx` (lines 28-35) — the existing `TARGET_TYPE_LABEL_KEYS: Record<string, string>` lookup-with-raw-fallback pattern for rendering `targetType`, defined locally per-component (not extracted to a shared utility) — mirror this exact pattern and convention.

---

## Design decisions

1. **List endpoint (`GET /tickets/:id/sla-escalations`), not singular** — resolved from the schema's own unique constraint permitting multiple rows per ticket.
2. **Empty result → `[]`, never 404** — resolved by contrast with `SlaTargetsService`'s legitimate 404 (every ticket always has exactly one target) versus escalations being sparse, normal-case-absent data, mirroring `NotificationLog`/`AuditLog`'s established convention.
3. **Reuse `sla:read`, no new permission key** — resolved because `sla:read` already gates every other SLA-domain read including the structurally-identical `sla-target` sibling; `notification:read`/`audit:read` were minted fresh only because those were genuinely new resource domains, which this is not.
4. **New sibling controller/service (`SlaEscalationsController`/`SlaEscalationsService`)**, not a method added to `SlaTargetsController` — mirrors this module's existing "one controller+service pair per concern" convention (`SlaPoliciesController` vs. `BusinessHoursCalendarsController` vs. `SlaTargetsController` are three separate pairs already).
5. **Frontend placement in `tickets-api.ts`/`use-tickets.ts`**, not `sla-policies-api.ts`/`use-sla-policies.ts` — resolved by the existing precedent that `getTicketSlaTarget` already lives in the ticket-scoped file despite being backend-owned by `sla-policies`.
6. **New card placed directly below the existing SLA card** on Ticket Detail — the two are conceptually paired (a ticket's SLA target and its escalation history against that target).
7. **`ticketEscalationsQueryKey` must be added to the existing `invalidateTicketQueries` function** — its own doc comment already states it reacts to `ticket.escalated` realtime events; omitting the new key would silently leave the new card stale after a live escalation. A required, in-scope addition to existing code, not scope creep.

---

## Implementation Tasks

### Backend

1. **New `apps/api/src/modules/sla-policies/sla-escalations.service.ts`**:
```ts
export interface SlaEscalationSummary {
  id: string;
  ticketId: string;
  branchId: string;
  targetType: string;
  targetAt: Date;
  escalatedAt: Date;
}

@Injectable()
export class SlaEscalationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getEscalationsForTicket(ticketId: string): Promise<SlaEscalationSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, branchId } });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const escalations = await this.prisma.slaEscalation.findMany({
      where: { ticketId },
      orderBy: { escalatedAt: "desc" },
    });

    return escalations.map((escalation) => ({
      id: escalation.id,
      ticketId: escalation.ticketId,
      branchId: escalation.branchId,
      targetType: escalation.targetType,
      targetAt: escalation.targetAt,
      escalatedAt: escalation.escalatedAt,
    }));
  }
}
```
2. **New `apps/api/src/modules/sla-policies/sla-escalations.controller.ts`**:
```ts
@ApiTags("sla-escalations")
@ApiBearerAuth()
@Controller("tickets")
export class SlaEscalationsController {
  constructor(private readonly slaEscalationsService: SlaEscalationsService) {}

  @Get(":id/sla-escalations")
  @RequirePermissions("sla:read")
  list(@Param("id") id: string): Promise<SlaEscalationSummary[]> {
    return this.slaEscalationsService.getEscalationsForTicket(id);
  }
}
```
(Doc comment mirroring `SlaTargetsController`'s exact justification for the `/tickets` mount.)
3. **`apps/api/src/modules/sla-policies/sla-policies.module.ts`** — register `SlaEscalationsController` in `controllers` and `SlaEscalationsService` in `providers`, mirroring how `SlaTargetsController`/`SlaTargetsService` are already wired.
4. No new DTO, no permission-catalog change.
5. Tests — see Test Plan.

### Frontend

6. **`apps/web/src/lib/tickets-api.ts`**:
```ts
export interface TicketEscalation {
  id: string;
  ticketId: string;
  branchId: string;
  targetType: string;
  targetAt: string;
  escalatedAt: string;
}

export function getTicketEscalations(id: string): Promise<TicketEscalation[]> {
  return apiFetch<TicketEscalation[]>(`/tickets/${id}/sla-escalations`);
}
```
7. **`apps/web/src/hooks/use-tickets.ts`**:
```ts
export const ticketEscalationsQueryKey = (id: string) => ["ticket", id, "escalations"] as const;

export function useTicketEscalationsQuery(id: string) {
  return useQuery({ queryKey: ticketEscalationsQueryKey(id), queryFn: () => getTicketEscalations(id) });
}
```
Add `ticketEscalationsQueryKey(id)` to the existing `invalidateTicketQueries` function's invalidation list (Design item 7).
8. **`apps/web/src/components/tickets/ticket-detail-view.tsx`** — new card below the existing SLA card:
```tsx
function TicketEscalationsCard({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const escalationsQuery = useTicketEscalationsQuery(ticketId);

  const TARGET_TYPE_LABEL_KEYS: Record<string, string> = {
    response: "escalations.targetType.response",
    resolution: "escalations.targetType.resolution",
  };

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.escalationsHeading")}</h2>
      {escalationsQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
      {escalationsQuery.isError && (
        <Alert variant="destructive">{t("detail.escalationsError")}</Alert>
      )}
      {escalationsQuery.isSuccess && escalationsQuery.data.length === 0 && (
        <p>{t("detail.escalationsEmpty")}</p>
      )}
      {escalationsQuery.isSuccess && escalationsQuery.data.length > 0 && (
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {escalationsQuery.data.map((escalation) => (
            <li key={escalation.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-medium text-slate-800">
                {TARGET_TYPE_LABEL_KEYS[escalation.targetType]
                  ? t(TARGET_TYPE_LABEL_KEYS[escalation.targetType])
                  : escalation.targetType}
              </span>
              <span className="text-slate-500">
                {new Date(escalation.escalatedAt).toLocaleString(locale)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```
(Exact prop-drilling/locale access adapted to match the real file's existing conventions during implementation.)
9. **Tests** — see Test Plan.

---

## API contract

`GET /tickets/:id/sla-escalations` — `@RequirePermissions("sla:read")` — 401 no token; 403 missing permission; 404 `"Ticket not found"` for cross-branch/nonexistent ticket; 200 `SlaEscalationSummary[]` (empty array if none) otherwise.

## Authorization / tenant-scoping rules

Identical mechanism to `SlaTargetsService`: `TenantContext.requireBranchScope()` → `prisma.ticket.findFirst({ where: { id, branchId } })` → 404 masks both "doesn't exist" and "exists in another branch" identically (no existence leak).

## Backend implementation

See Implementation Tasks 1-4.

## Frontend implementation

See Implementation Tasks 6-8.

## Tests

**Backend unit** (new `apps/api/src/modules/sla-policies/sla-escalations.service.spec.ts`, mirroring `sla-targets.service.spec.ts`'s mock harness):
- returns escalations for a ticket in the caller's branch, ordered `escalatedAt: "desc"` (assert exact `findMany` args)
- returns `[]` when the ticket has no escalations (not an error)
- throws `NotFoundException` for a ticket not in the caller's branch (assert `slaEscalation.findMany` never called)
- propagates TenantContext's error when there is no active branch

**Backend e2e** (new `apps/api/test/sla-escalations.e2e-spec.ts`, combining `sla-targets.e2e-spec.ts`'s bootstrap with `sla-breach-escalation.e2e-spec.ts`'s event-emission technique):
- 401 no token
- 403 Agent-role user (lacks `sla:read`)
- a ticket with no escalations → 200 `[]`
- emit `SLA_BREACHED_EVENT` on the real `EventEmitter2` to produce a genuine `SlaEscalation` row, then confirm `GET .../sla-escalations` returns it with correct `targetType`/`targetAt`/`escalatedAt`
- 404 for an unknown/cross-branch ticket id

**Frontend component** (extend `ticket-detail-view.spec.tsx`):
- loading, error, empty, populated states for the new card
- correct target-type label rendering (`"response"` → "Response"; an unrecognized value → raw string fallback, no crash)
- correct timestamp rendering
- confirm no interference with the existing SLA/History cards' own tests

## Regression requirements

Existing SLA-target card tests and History card tests remain green, unmodified. No other admin screen's tests are affected.

## Migration requirements

**None.** No Prisma schema change.

## Edge cases

- A ticket with both a response and a resolution escalation → both rows returned, newest first.
- An unrecognized `targetType` value → raw-string fallback, never a crash (established pattern, mirrored exactly).
- The realtime invalidation gap flagged in Design item 7 — must be closed as part of this story, not left as a follow-up.

## Security risks/mitigations

No new privilege surface — this is a pure read extension of an already-permission-gated, already-branch-scoped domain, reusing an existing key rather than introducing one.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e   # requires Docker/Postgres — confirmed unreachable in this session's environment; disclose honestly if still unreachable at implementation time
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `GET /tickets/:id/sla-escalations` exists, gated by `sla:read`, returns `[]` for no data and real rows (newest-first) otherwise; 404 for cross-branch/nonexistent tickets.
- [ ] No new permission key; no Prisma migration.
- [ ] Ticket Detail shows the new escalations card with correct loading/error/empty/populated states.
- [ ] `invalidateTicketQueries` includes the new query key.
- [ ] All listed tests exist and pass; existing SLA-target/History card tests remain green, unmodified.
- [ ] Both locales translated.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean (not yet committed).

---

## Non-Goals (explicit)

- Any change to SLA breach detection or escalation-creation logic (`sla-escalation.listener.ts` untouched unless a genuine defect surfaces during implementation — none found here).
- Any change to `TicketHistoryEntry`.
- Any branch-wide/cross-ticket SLA escalation dashboard.
- Reporting/analytics.
- Ticket messaging/comments/conversations.
- Communication Channels, Customer Portal, AI features.
- Any identity/admin work (Stories 45–48, untouched).
- `createUser`'s known, separately-disclosed branch-scoping inconsistency.
- Any unrelated hardening/refactoring.
- Any README change.

---

## Dependencies

See Prerequisites. No hard sequencing beyond the usual backend-before-frontend order (the new endpoint must exist before the frontend query hook can be wired against it).

## Known blockers

Docker Desktop unreachable in this session's environment — e2e cannot be executed here; the suite is designed and will be disclosed as not-run, not fabricated, exactly as for Stories 45–48.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
