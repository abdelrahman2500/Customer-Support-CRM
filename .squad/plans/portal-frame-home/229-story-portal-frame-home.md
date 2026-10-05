# Story 229 — Portal frame and home

> CRM product redesign roadmap item **PR-5.1**. Intake: [`../../stories/portal-frame-home/portal-frame-home/intake.md`](../../stories/portal-frame-home/portal-frame-home/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 5.

## Prerequisites

Stories 211, 214, 216.

## Story Goal

The portal's lighter chrome and a home page organised around the customer's three jobs, speaking the same status language as the agent board.

**Non-goals:** the portal tickets/help/account screens; a status breakdown (no backend filter).

## Design decisions

1. **Header** — `border-t-[3px] border-brand` stripe on a white surface with `shadow-sm`; an inner `max-w-5xl` row matches `main`'s `max-w-5xl` column. Hamburger below `lg` (six links overflowed at 768px).
2. **SSR branding** — `lib/branding-server.ts` (`/portal/branding`, same shape as web's); `(customer)/layout.tsx` reads it alongside the contact (`Promise.all`) and passes `initialBranding`; `useBrandingQuery(initialData)`.
3. **Home** — PageHeader (title + description); a `nav` of three `ActionCard`s (`/tickets#new-ticket`, `/knowledge-base`, `/chat`); a `lg:grid-cols-5` row: tickets (3) as `TicketMiniCard`s with `toneSpine(...).start` on the inline-start edge, help highlights (2). The "Explore" row is removed (the cards and the header nav cover it).
4. **Shared spine** — `@crm/ui` `toneSpine(tone)` returns `{border, dot, top, start}`; web's `statusSpine` delegates to it.
5. **Anchor** — the portal create-ticket card gets `id="new-ticket"` (`scroll-mt-4`).

## Tasks

1. ui `status-spine.ts` (+spec, export); web `board-state.ts` delegates.
2. Portal branding-server, layout, header, home view, messages (`home.actions.*`; `home.explore` removed), list anchor.
3. Specs: home (action cards, spine; the Explore-link test rewritten — reason recorded), header (initial branding), board-state (`start`).

## Verification Steps

1. portal/web/ui vitest, typecheck, lint, builds; Playwright full suite.
2. Harness: home 390/768/1024/1280 × en/ar × light/dark; tickets 390/1280.

## Done Criteria

- [ ] Frame, SSR branding, home, shared spine; suites green.
