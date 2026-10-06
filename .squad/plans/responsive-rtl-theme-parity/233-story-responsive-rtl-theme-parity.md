# Story 233 — Responsive, RTL and theme parity

> CRM product redesign roadmap item **PR-6.2**. Intake: [`../../stories/responsive-rtl-theme-parity/responsive-rtl-theme-parity/intake.md`](../../stories/responsive-rtl-theme-parity/responsive-rtl-theme-parity/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 6.

## Prerequisites

Story 232.

## Story Goal

Verify every route at every reference size, language, theme and brand; fix only the gaps.

**Non-goals:** redesigns; new screens.

## Audit results

- **Parity matrix** — 42 pages (32 web, 8 portal, 2 logins) × 390/768/1280/1440 × en/ar × light/dark = **672 checks, 0 failures** (no horizontal overflow, exactly one h1, no page errors, no Arabic-Indic digits in Arabic: PD-8 holds for numbers, dates, times and chart labels). Re-run at 390/1280 on the final build: 336/336.
- **Brands** — default indigo, passing green `#15803d`, failing yellow `#facc15`, failing red `#ef4444` × light/dark × dashboard, board, ticket, reports, portal home and tickets: **48 axe colour-contrast scans, 0 violations**. The brand edge always shows; failing colours keep the accent on the default (the Story 183 gates). Branding PATCHed through the admin API and restored to its original values.
- **Gap found** — mixed-direction text: an English message, CSAT comment or subject in the Arabic UI put its final punctuation on the wrong side ("?This should be fixed now").

## Design decisions

1. **Paragraphs** take their direction from their text: `dir="auto"` on `MessageBubble`'s body (both apps' conversations and the assistant), KB article bodies (web read view, portal), CSAT comments (both apps).
2. **Single-line user text** is isolated with `<bdi>`, keeping the parent's alignment: `PageHeader` titles (h1/h2), message senders, ticket subjects (board card, list, dashboard, header, customer and context panels, portal cards), article titles (lists, detail, KB references, portal home), customer names (list, detail, context panel) — 19 call sites plus the two shared components.
3. No logo in the demo branch; the logo plate was verified in Story 184.

## Verification Steps

1. ui/web/portal vitest, typecheck, lint, builds; Playwright full suite.
2. Parity, brand and portal-detail harnesses.

## Done Criteria

- [ ] Matrices clean; bidi fix applied; suites green.
