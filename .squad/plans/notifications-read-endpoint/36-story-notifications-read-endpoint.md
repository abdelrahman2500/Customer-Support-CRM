# Story 36 — Backend Foundation: Notification Read Endpoint

## Prerequisites

- `sla-at-risk-notification-reaction` Story 18, `ticket-escalation-notification-reaction` Story 19: `NotificationLog` model, `SlaAtRiskNotificationListener`, `TicketEscalatedNotificationListener`.

## Story Goal

Give `NotificationsModule` its first HTTP surface: a read-only `GET /notifications`, correctly scoped despite `NotificationLog.branchId` being nullable for escalation rows.

## Context — Read These Files First

1. `apps/api/src/modules/notifications/notifications.module.ts` — confirms no controller exists yet, and neither listener runs in request scope (so `TenantContext` isn't provided there yet).
2. `apps/api/src/modules/notifications/ticket-escalated-notification.listener.ts` — confirms `TICKET_ESCALATED_EVENT` rows always persist with `branchId: null`.
3. `apps/api/prisma/schema.prisma`'s `NotificationLog` model doc comment — confirms this nullability is a deliberate, documented Story 19 design choice, not a bug.
4. `apps/api/test/sla-at-risk-notification.e2e-spec.ts` — the exact "emit on the real `EventEmitter2`, poll for the persisted row" technique this story's e2e test reuses.

## Design (resolved during this planning pass)

1. **Scope through the `ticket` relation (`ticket.branchId`), not `NotificationLog.branchId` directly** — the only way to include every notification row (including escalation rows) for the caller's branch without silently dropping some.
2. **Resolve each row's returned `branchId`** as `notification.branchId ?? notification.ticket.branchId` — so the exposed data is never confusingly inconsistent.
3. **New `notification:read` permission**, own value (this isn't closely related to any existing SLA/user/branch permission).
4. **`NotificationsModule` now provides `TenantContext`** (needed by the new request-scoped service) alongside the existing listener providers.
5. Ordered `loggedAt: "desc"` (newest first) — a presentation default, not a business rule; no pagination (matches every other list endpoint).

## Implementation Tasks

1. New `notifications.service.ts`: `NotificationSummary` (mirrors the model minus internal `dedupeKey`), `listNotifications()`.
2. New `notifications.controller.ts`: `GET /notifications`, `@RequirePermissions("notification:read")`.
3. Update `notifications.module.ts`: add controller, service, `TenantContext` to providers.
4. `seed.ts`: add `"notification:read"`.
5. Unit tests: new `notifications.service.spec.ts` — scoping-through-relation, empty, sla.at_risk-mapped-as-is, ticket.escalated-branchId-resolved, ordering, no-active-branch.
6. e2e tests: new `notifications-read.e2e-spec.ts` — 401, array-shape, real sla.at_risk row surfaced, real ticket.escalated row surfaced with resolved branchId, 403 for Agent.

## Migration / Rollback

None. No schema change. Rollback is a plain code revert plus re-running the seed.

## Verification Steps

1. `pnpm --filter @crm/api typecheck`/`lint`/`test`.
2. `pnpm --filter @crm/api prisma:seed`.
3. `pnpm --filter @crm/api test:e2e`.
4. `git status` — confirm `apps/web`, `apps/portal`, `schema.prisma`, migrations, and every unrelated module have empty diffs.

## Done Criteria

- [ ] Endpoint returns real, correctly-scoped data including escalation rows.
- [ ] 401/403 enforced correctly.
- [ ] No schema/migration change; no mutation endpoint; no frontend.
- [ ] Unit + e2e tests pass.
- [ ] No unrelated file touched.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
