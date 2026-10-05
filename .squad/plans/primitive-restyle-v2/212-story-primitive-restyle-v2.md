# Story 212 — Primitive restyle to v2

> CRM product redesign roadmap item **PR-1.3**. Intake: [`../../stories/primitive-restyle-v2/primitive-restyle-v2/intake.md`](../../stories/primitive-restyle-v2/primitive-restyle-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 1.

## Prerequisites

Stories 210 (recipes, chrome tokens) and 211 (kit).

## Story Goal

Bring the existing primitives onto the v2 recipes where they differ, without changing behaviour.

**Non-goals:** screen changes; primitives already on v2 (Badge, Tabs, Table, Skeleton, Toast — reviewed, unchanged).

## Design decisions

1. **Card** `elevation="raised"`: `shadow-resting` → `border-rule-strong` (borders before shadows). The three raised call sites get the crisper hairline.
2. **EmptyState**: `border-dashed` box → `rounded-surface bg-surface-muted/60` panel; the icon disc `h-12 w-12 bg-surface ring-1 ring-rule`.
3. **Avatar** `variant="unassigned"`: `border-dashed border-rule-control text-ink-subtle`, `UnassignedIcon` (lucide `UserRound`) instead of initials; `name` stays the accessible name.
4. **Button** `variant="chrome"`: `text-chrome-muted hover:bg-chrome-raised hover:text-chrome-ink active:bg-chrome-active`; focus comes from the chrome's `.on-chrome` scope.
5. The icon is exported in a trailing statement of `icons.ts` (and a trailing barrel block), so it stages separately from a concurrent session's uncommitted edits in those files.

## Tasks

1. The four component changes + spec cases; three old-look assertions updated with recorded reasons.
2. Icon vocabulary + icons spec.

## Verification Steps

1. ui/web/portal tests, typecheck, lint, prettier; web + portal builds.
2. Harness: dashboard and a ticket × en/ar × light/dark @1280 (raised card, empty states).
3. Hunk-only staging of `icons.ts`/`index.ts`; protected checksum.

## Done Criteria

- [ ] Four primitives on v2 with specs; behaviour unchanged.
- [ ] Suites, builds and harness green.
