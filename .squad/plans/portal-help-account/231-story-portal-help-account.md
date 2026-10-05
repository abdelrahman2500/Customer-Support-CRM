# Story 231 — Portal help and account

> CRM product redesign roadmap item **PR-5.3**. Intake: [`../../stories/portal-help-account/portal-help-account/intake.md`](../../stories/portal-help-account/portal-help-account/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 5.

## Prerequisites

Stories 205, 207, 211, 229, 230.

## Story Goal

The portal's help, assistant, notification and account screens share the product's language and never leave a customer at a dead end.

**Non-goals:** profile editing; new endpoints.

## Design decisions

1. **KB list** — `PageHeader` (description, fetch indicator in actions); `type="search"` input with the search icon (`h-11 max-w-xl`); `sm:grid-cols-2` cards: category caption, the title as the card's only link (stretched with `after:inset-0`, so its name stays the title and the long-title guard still holds), a two-line excerpt (first 220 characters).
2. **StillNeedHelp** — a labelled `aside` on the accent surface: "Ask the assistant" (`/chat`) and "Raise a ticket" (`/tickets#new-ticket`); under the list and under each article.
3. **Article** — `max-w-3xl` `article` card, category above the title, body at `text-body-lg`.
4. **Assistant** — `PageHeader` h1 + description, "Talk to a person" in its actions once messages exist; `ConfirmDialog` before escalating; a `flex-1` card holding `MessageThread fill`, a mounted `role="status"` thinking line, outcome alerts and the `Composer` (labelled field, hint, send waits for a session).
5. **`MessageThread fill`** — wrapper `flex min-h-0 flex-1 flex-col`, log `min-h-0 flex-1` instead of `max-h-[60vh] min-h-64`.
6. **Notifications** — history first, `NotificationPreferencesSection` after it; each row a `Label` + `Switch` (the pill and Enable/Disable button removed, and their four keys).
7. **Account** — `max-w-3xl` column.

## Tasks

1. ui `MessageThread` `fill` (+spec).
2. Portal views, `still-need-help.tsx` (+spec), messages.
3. Specs: chat (Composer label, confirm step, h1, cancel), preferences (switches).

## Verification Steps

1. portal/ui vitest, typecheck, lint, builds; Playwright full suite.
2. Harness: four screens at 390/1280 × en/ar × light/dark; chat send/thinking/confirm and an article at en-light-1280 / ar-dark-390.

## Done Criteria

- [ ] KB, assistant, notifications, account; suites green.
