# Story 63 — Notifications — Custom Templates in the Live Toast

## Prerequisites

- `notification-templates` Story 61: `NotificationTemplate`, `GET /notification-templates`, `useNotificationTemplatesQuery`, and its exact `{ticketId}`/`{targetType}` plain-text substitution semantics (extracted here into a shared helper, not reimplemented).

---

## Story Goal

Extend the branch-wide live in-app toast (`NotificationToaster`) to render a custom template's substituted text as the toast's message body, when one exists for that event type — the last of the two consumption surfaces Story 61's own plan named (`NotificationHistoryView`'s event-label cell was the first). Falls back to the exact existing hardcoded message otherwise.

**Not in scope**: changing the Badge's event-type label in the toast (stays the plain categorical tag — see Design decision 3 for why this differs from the History table's own choice); live branding CSS-variable consumption (a separate, larger, deliberately-deferred piece of Administration); any change to `BranchNotificationRealtimeListener`/the branch-wide broadcast itself (still unchanged since Story 22).

---

## Context — Read These Files First

1. `apps/web/src/components/notifications/notification-history-view.tsx` — the exact `renderTemplate`/substitution logic this story extracts into a shared helper and reuses verbatim (never reimplemented a second time).
2. `apps/web/src/components/notifications/notification-toaster.tsx` — `messageFor()`, `ticketIdFor()`, `isSlaDetectionPayload()`/`isTicketEscalatedPayload()` — the exact extension point; `ticketIdFor()` already resolves a real ticket id for all three event types, reused here for the `{ticketId}` placeholder.
3. `apps/web/src/components/notifications/branch-notifications.tsx` — already fetches `useNotificationPreferencesQuery()` at the same mount point (Story 58); this story adds a second, independent query the same way, never blocking the other.

---

## Design decisions

1. **Extract the substitution logic into a new shared `apps/web/src/lib/notification-template-render.ts`** (`renderNotificationTemplate(template, { ticketId, targetType })`) — both `NotificationHistoryView` and `NotificationToaster` import it; the exact same plain-text, no-ICU behavior Story 61 already established, never duplicated a second time.
2. **The toast's message body (`messageFor()`'s return value) is replaced by the rendered template; the Badge's event-type label is untouched** — unlike the History table (a single labeled cell, where the template *is* the label), the toast has two distinct text elements (a short categorical Badge tag, and a full message line). Replacing only the message line keeps the Badge legible as a quick visual category cue even when a branch has customized the message text, and avoids showing the same custom text twice.
3. **`BranchNotifications` fetches `useNotificationTemplatesQuery()` at the same mount point it already fetches `useNotificationPreferencesQuery()`** (Story 58) — an independent query; while loading or erroring, every event type falls back to its default message (never silently blocking the toast from rendering, same convention Story 58 established for preferences).
4. **No backend change** — `GET /notification-templates` already exists and is already permission-gated; this story is a pure frontend consumer.

---

## Implementation Tasks

1. **New `apps/web/src/lib/notification-template-render.ts`** — `NotificationTemplatePlaceholders` interface (`ticketId: string`, `targetType?: string | null`), `renderNotificationTemplate(template, placeholders)`.
2. **`apps/web/src/components/notifications/notification-history-view.tsx`** — remove the local `renderTemplate` function; import and call the shared one instead. No behavior change (existing tests must pass unmodified).
3. **`apps/web/src/components/notifications/notification-toaster.tsx`** — accept an optional `templateByEventType: Map<string, string>` prop on `NotificationToaster`; `messageFor()` takes an optional `template` argument and, when present, calls `renderNotificationTemplate(template, { ticketId: ticketIdFor(notification) ?? "", targetType: isSlaDetectionPayload(notification) ? notification.payload.targetType : undefined })` instead of its existing `t(key, {...})` calls.
4. **`apps/web/src/components/notifications/branch-notifications.tsx`** — fetch `useNotificationTemplatesQuery()`, build the `templateByEventType` map (mirrors `NotificationHistoryView`'s own `useMemo`), pass it to `<NotificationToaster templateByEventType={...} />`.
5. **Tests** — see Test Plan.

---

## API contract

No new/changed endpoint — consumes the existing `GET /notification-templates` (Story 61) unchanged.

## Tests

**Frontend unit** (new `notification-template-render.spec.ts`): substitution correctness, unrecognized-placeholder-left-verbatim, missing-targetType-becomes-empty-string.

**Frontend component**: `notification-toaster.spec.tsx` extended — a custom template's substituted text renders as the message body when one exists for that event type; the Badge label is unaffected; falls back to the exact existing message when no template exists. `notification-history-view.spec.tsx`'s existing template tests continue to pass unmodified against the now-shared helper (proves the extraction was behavior-preserving).

## Regression requirements

Every existing test suite remains green, unweakened — especially `NotificationHistoryView`'s and `NotificationToaster`'s pre-existing tests, unmodified, proving both the extraction and the new consumption point are behavior-preserving by default.

## Migration requirements

None.

## Security risks/mitigations

- No new surface: reuses the already-permission-gated `GET /notification-templates`; rendered as React text content only (never `dangerouslySetInnerHTML`), so no new XSS surface.

## Verification commands

```
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `renderNotificationTemplate` extracted to a shared file; both consumers use it, no duplicated logic.
- [ ] The live toast renders a custom template's message when one exists for that event type; falls back to the exact existing message otherwise.
- [ ] The Badge's event-type label is unaffected by a custom template.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Changing the toast Badge's event-type label; live branding CSS-variable consumption; any change to the branch-wide broadcast/`BranchNotificationRealtimeListener`.
- Any README change.
