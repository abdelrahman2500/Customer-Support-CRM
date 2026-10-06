# Story 232 — Accessibility hardening

> CRM product redesign roadmap item **PR-6.1**. Intake: [`../../stories/accessibility-hardening/accessibility-hardening/intake.md`](../../stories/accessibility-hardening/accessibility-hardening/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 6.

## Prerequisites

Phases 3–5 (Stories 216–231).

## Story Goal

An audit of every route with axe and the keyboard, fixing what it finds, and a status for every recon accessibility finding.

**Non-goals:** new features; a CI accessibility gate.

## Audit results

- **axe-core 4.13**, every route (32 web, 8 portal, 2 logins = 42 pages per variant):
  - before: 42/42 pages *serious* (`document-title`), plus a minor `empty-table-header` (My Account);
  - after: 1280 × en-light + ar-dark → 84 scans, 0 violations; 390 × en-dark + ar-light → 84 scans, 0 violations (the webhook badge overflow, `scrollable-region-focusable`, fixed in between).
- **Keyboard walk** (first 40 Tab stops): web login, dashboard, board, list, customers, KB, settings, my account, ticket detail; portal home, tickets, KB, assistant, notifications, account, ticket detail — every stop has an accessible name and a visible focus indicator.

## Design decisions

1. **Titles** — `lib/page-title.ts` (`pageTitle(namespace, key)` → `generateMetadata`) in both apps; every `page.tsx` exports one using its nav label; the client login pages get a pass-through `layout.tsx`; `[locale]/layout.tsx` sets `{ template: "%s · <appName>", default: appName }`.
2. **A11Y-07** — 34 conditionally rendered `text-danger-foreground` elements get `role="alert"` (`role="status"` for the branding colour validation shown while typing).
3. **My Account** — the revoke column header is `sr-only` "Actions".
4. **Webhooks** — the result badge carries the status word; the free-text reason sits under it and wraps.
5. **Guards** — `src/test/a11y-guards.spec.ts` (web, scans both apps): every page/route layout exports `generateMetadata`, the locale layout has the template, every danger-text element has a role.

## Recon A11Y findings

| ID | Status |
|---|---|
| A11Y-01 live regions | Closed — `MessageThread` `role="log"` in both apps (205, 230, 231); assistant "Thinking…" in a `role="status"` (231). |
| A11Y-02 file input names | Closed — `FileDropzone` (208, 230). |
| A11Y-03 missing h1 | Closed — error states (199); portal assistant (231). |
| A11Y-04 heading order | Closed — portal tickets page header before the create card (230); settings one h1 (224). |
| A11Y-05 mention combobox | Closed — `Composer` suggestions (207). |
| A11Y-06 repeated names | Closed — unique KB row actions (219); "View all" removed with the customer panel redesign (219). |
| A11Y-07 unannounced errors | Closed here (34 sites + guard). |
| A11Y-08 focus rings | Closed — `NativeSelect`/`focus-ring` (182, 189); verified by the keyboard walk. |
| A11Y-09 placeholder names, focus loss | Closed — `Composer` labels and never-disabled field (207, 230, 231). |
| A11Y-10 toast region | Closed — regions always mounted (193). |
| A11Y-11 unread count masking | Closed (200). |
| A11Y-12 contrast | Closed — tokens (180); axe colour-contrast clean in all four variants. |
| A11Y-13 colour-only status | Closed — status/priority badges carry icons; SLA indicator has text + icon. |
| A11Y-14 reduced motion | Closed — global `prefers-reduced-motion` rule in `tailwind-tokens.css` (179). |
| A11Y-15 mouse-only rows | Closed — rows keep an inner link; portal rows became full-card links (230/231). |

## Verification Steps

1. web/portal vitest, typecheck, lint, builds; Playwright full suite.
2. axe harness (both matrices) and keyboard harness.

## Done Criteria

- [ ] 0 critical/serious; keyboard walk clean; findings closed; suites green.
