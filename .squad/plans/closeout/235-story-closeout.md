# Story 235 — Closeout

> CRM product redesign roadmap item **PR-7.2**. Intake: [`../../stories/closeout/closeout/intake.md`](../../stories/closeout/closeout/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 7.

## Prerequisites

Stories 210–234.

## Story Goal

The redesign documented as shipped, its leftovers cleaned up, and a demo walkthrough.

**Non-goals:** new features or redesigns.

## Design decisions

1. **Design language** (`docs/architecture/13-design-language.md`) — status spine now names `toneSpine` and the portal's uses; portal chrome; the PD-8 paragraph corrected (Reports pins `-u-nu-latn`, which the doc said was never done); mixed-direction rule; new sections: accessibility contract, primitives and patterns index, visual regression.
2. **Stale comments** — the portal header's nav breakpoint (`sm` → `lg`, Story 229) and the Reports view's filter history (URL, toolbar "Clear all", KPI row, Story 228).
3. **Unused keys** — `tickets.sla.breachedAt` and `tickets.sla.remaining` (web en/ar), superseded by `dueIn`/`breachedTargetAt`. The scan found nothing else in either app.
4. **`docs/demo-script.md`** — setup (fresh demo seed, accounts), the agent's day, running the team, the customer's side, "built for everyone", troubleshooting.
5. **`00-index.md`** — one row per feature folder for Stories 210–235.

## Verification Steps

1. Full validation: ui/web/portal vitest, typecheck and lint for every package, both builds, Playwright suite, visual compare (after a reseed).

## Done Criteria

- [ ] Docs, comments, keys, demo script, index; validation green.
