# Story 61 — Notifications — Custom Message Templates (Foundation)

## Prerequisites

- `notifications-read-endpoint` Story 36: `NotificationLog`/`NotificationsController`/`NotificationsService` — the exact branch-scoped read pattern and `NotificationSummary` shape this story's consumption extends.
- `notification-preferences` Story 58: `NotificationsModule`'s "grow this module per schema concern" precedent, and its own self-scoped-vs-branch-scoped controller split (this story's template CRUD is branch-scoped, like `NotificationsController`, not self-scoped like `NotificationPreferencesController`).

---

## Story Goal

Let a branch admin define a custom message template per notification event type (`sla.at_risk`, `sla.breached`, `ticket.escalated`) — plain text with `{ticketId}`/`{targetType}` placeholders — and have the existing Notification History table render it in place of the hardcoded default label, when one exists. Closes the last of Notifications' three named pieces (`docs/architecture/03-domain-boundaries.md`: "Templates, delivery logs, per-user preferences" — the latter two shipped in Stories 36/58).

**Not in scope**: consumption in the live in-app toast (`NotificationToaster`) — deliberately deferred (see plan overview's dependency note); email/SMS/push template rendering (no such channel exists); a full ICU/i18n templating engine (plain `{name}` substitution only, no pluralization/formatting); per-user (vs. per-branch) templates; template versioning/preview.

---

## Context — Read These Files First

1. `apps/api/src/modules/notifications/notifications.service.ts` / `notifications.controller.ts` — the exact branch-scoped `NotificationLog` read pattern this story's `NotificationTemplate` CRUD mirrors structurally (different model, same shape).
2. `apps/api/src/modules/sla-policies/{sla-policies.service,sla-policies.controller}.ts` — the exact `create`/`list`/`update` CRUD shape (branch-scoped, `findXInScope` 404-masking) this story's `NotificationTemplatesService`/`Controller` mirror field-for-field.
3. `apps/web/src/components/notifications/notification-history-view.tsx` — `EVENT_LABEL_KEYS`, the exact rendering point this story's template substitution extends (falls back to the existing behavior when no template exists — zero behavior change for any branch that hasn't created one).
4. `apps/web/src/lib/notifications-api.ts` — `NotificationSummary`'s exact fields (`ticketId`, `targetType`) — the only two placeholders a template can reference, since that's all a persisted `NotificationLog` row carries (no `subject` — confirmed absent from the schema).

---

## Design decisions

1. **New `NotificationTemplate` model** (`notifications` schema, mirrors `NotificationPreference`'s shape): `id`, `branchId`, `eventType`, `template: String`, `createdAt`, `updatedAt`; `@@unique([branchId, eventType])` — exactly one template per event type per branch, upserted via `PATCH`, mirrors `SlaPolicy`'s "aggregate root, not a sub-entity" shape.
2. **Plain `{name}` substitution, not next-intl/ICU** — `template.replace(/\{ticketId\}/g, ...).replace(/\{targetType\}/g, ...)`; an admin-authored template is plain text, not a message-catalog entry, so it does not go through `next-intl` at all. Unrecognized placeholders are left verbatim (no error) — simplest safe behavior for a v1 foundation.
3. **Consumption limited to `NotificationHistoryView`'s event-label cell** — replaces `EVENT_LABEL_KEYS[eventType]`'s translated label with the rendered template when one exists for that row's branch+eventType; falls back to the exact existing behavior otherwise. The live toast (`NotificationToaster`) is untouched (Non-Goal).
4. **New permissions `notification:create`/`notification:update`**, added to `PERMISSION_CATALOG`; existing `notification:read` reused for `GET /notification-templates` (mirrors `sla:create`/`sla:read`/`sla:update`'s exact three-permission shape). Granted to `SuperAdmin` only via the existing wildcard; `Agent` gets none by default.
5. **Branch-scoped via `TenantContext.requireBranchScope()`**, identical mechanism to every other branch-scoped resource — never self-scoped (unlike `NotificationPreference`, a template is an admin-managed branch resource, not a personal one).
6. **New Agent Workspace "Notification Templates" screen** — list + inline create/edit form (one row per event type, pre-populated if a template already exists), mirrors `AutomationRulesView`'s exact shape.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — add `NotificationTemplate` (`notifications` schema) + back-relation on `Branch`.
2. **Migration** — generated via `prisma migrate dev`.
3. **`apps/api/prisma/seed.ts`** — add `"notification:create"`, `"notification:update"` to `PERMISSION_CATALOG`.
4. **New `apps/api/src/modules/notifications/dto/{create-notification-template.dto,update-notification-template.dto}.ts`** — `eventType` (`@IsIn(["sla.at_risk","sla.breached","ticket.escalated"])`), `template` (`@IsString() @MinLength(1)`).
5. **New `apps/api/src/modules/notifications/notification-templates.service.ts`** — `NotificationTemplateSummary` interface; `createOrUpdateTemplate` (upsert on `branchId_eventType`), `listTemplates`, mirrors `SlaPoliciesService`'s shape.
6. **New `apps/api/src/modules/notifications/notification-templates.controller.ts`** — `POST /notification-templates` (`notification:create`), `GET /notification-templates` (`notification:read`), `PATCH /notification-templates/:id` (`notification:update`).
7. **`apps/api/src/modules/notifications/notifications.module.ts`** — add the new controller/service.
8. **Tests** — see Test Plan.

### Frontend

9. **New `apps/web/src/lib/notification-templates-api.ts`** — own file: `NotificationTemplateSummary` type + `listNotificationTemplates`/`createNotificationTemplate`/`updateNotificationTemplate`.
10. **New `apps/web/src/hooks/use-notification-templates.ts`** — `useNotificationTemplatesQuery`, `useCreateNotificationTemplateMutation`, `useUpdateNotificationTemplateMutation`.
11. **New `apps/web/src/components/notifications/notification-templates-view.tsx`** — one row per fixed event type, inline edit form, mirrors `AutomationRulesView`.
12. **New `apps/web/src/app/[locale]/(agent)/notification-templates/page.tsx`** — one-line pass-through.
13. **`apps/web/src/components/workspace/workspace-nav.tsx`** — append `{ href: "notification-templates", labelKey: "nav.notificationTemplates" }`.
14. **`apps/web/src/components/notifications/notification-history-view.tsx`** — fetch templates via the new query; a small `renderEventLabel(row, templates, t)` helper substitutes `{ticketId}`/`{targetType}` when a template exists for that row's `eventType`, else keeps the existing `EVENT_LABEL_KEYS`-driven label.
15. **i18n** — `apps/web/messages/{en,ar}.json`: `workspace.nav.notificationTemplates` + a new top-level `notificationTemplates` namespace.
16. **Tests** — see Test Plan.

---

## API contract

- `POST /notification-templates` — `notification:create` — `{ eventType, template }` → upserted row (create-or-update semantics, since `@@unique([branchId, eventType])`).
- `GET /notification-templates` — `notification:read` — every template in the caller's branch (only existing ones, not zero-padded).
- `PATCH /notification-templates/:id` — `notification:update` — `{ template }`.

## Tests

**Backend unit** (new `notification-templates.service.spec.ts`): upsert create-vs-update path, branch scoping, 404 on update for an out-of-branch/unknown id.

**Backend e2e** (new `notification-templates.e2e-spec.ts`): 401/403; real create-then-list; a real update reflected on next list; branch isolation (a template in one branch never appears in another's list — reuses the existing second-branch/second-org fixture pattern already used elsewhere, or documents the same "single seeded branch" scope limitation `sla-policies.e2e-spec.ts` already discloses).

**Frontend component**: `notification-templates-view.spec.tsx` (list/create/edit states); `notification-history-view.spec.tsx` extended (a row renders the substituted template when one exists for its `eventType`, and keeps the existing label when none does).

## Regression requirements

Every existing test suite remains green, unweakened. `NotificationHistoryView`'s existing tests must all still pass unmodified in their assertions (only new tests added) — confirms the fallback path is truly behavior-preserving.

## Migration requirements

One migration: new `notification_templates` table. No existing table altered.

## Security risks/mitigations

- **Branch isolation**: identical `TenantContext.requireBranchScope()` mechanism as every other branch-scoped resource.
- **New permission surface**: `notification:create`/`notification:update` gate writes; `notification:read` (already existing) gates reads — no existing permission's meaning changes.
- **No injection risk from admin-authored templates**: plain-text substitution only, rendered as React text content (never `dangerouslySetInnerHTML`), so no XSS surface is introduced.

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

- [ ] `NotificationTemplate` exists, migration applied.
- [ ] CRUD routes exist, permission-correct, branch-scoped.
- [ ] Notification History renders a custom template when one exists, falls back to the existing label otherwise (zero behavior change for every branch without one).
- [ ] New Agent Workspace screen lists/creates/edits templates.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Live in-app toast consumption; email/SMS/push template rendering; a full ICU/i18n templating engine; per-user templates; template versioning/preview.
- Any README change.
