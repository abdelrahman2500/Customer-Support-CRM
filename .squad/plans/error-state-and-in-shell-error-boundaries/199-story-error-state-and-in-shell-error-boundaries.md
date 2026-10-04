# Story 199 — ErrorState and in-shell error boundaries

> CRM UI/UX redesign roadmap item **RD-2.5**. Intake: [`../../stories/error-state-and-in-shell-error-boundaries/error-state-and-in-shell-error-boundaries/intake.md`](../../stories/error-state-and-in-shell-error-boundaries/error-state-and-in-shell-error-boundaries/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 2 "RD-2.5"; recon NAV-05, A11Y-03, VL-08.

---

## Prerequisites

- Story 187 (RD-1.10) surfaces; Story 189 (RD-1.12) `BackLink`; Story 198 (RD-2.4): the branch page `h1` in every state, and business hours' `hosted` prop.

---

## Story Goal

1. **`ErrorState`** in `@crm/ui`.
2. **An agent error boundary inside the shell** (`(agent)/error.tsx`), so a render error keeps the header and navigation (NAV-05).
3. **Migrate the hand-rolled error and not-found cards in both apps**, including the portal's raw `<button>`, to `ErrorState`.
4. **Detail-page load errors** (web customer, web KB article, portal ticket, portal KB article) render `ErrorState` as the page: an `h1`, a back link and, for non-404 errors, a retry that calls the existing `refetch` (A11Y-03, VL-08).
5. **Business hours** keeps its `PageHeader` in the loading and error states. Its error gains a retry.

**Non-goals:**
- loading-skeleton redesign
- a portal in-shell boundary (the portal has no shell navigation that a render error would lose beyond its header; noted for later)
- any copy change beyond reusing existing keys
- any backend change

---

## Design decisions

1. **The `ErrorState` API** (server-safe: no hooks, no `"use client"`):

   ```ts
   interface ErrorStateProps {
     title: React.ReactNode;
     description?: React.ReactNode;
     tone?: "danger" | "neutral";   // ErrorIcon on danger-subtle / InfoIcon on surface-muted
     headingLevel?: 1 | 2 | 3;      // default 2
     actions?: React.ReactNode;     // e.g. a retry Button
     back?: React.ReactNode;        // e.g. a BackLink or Link
     className?: string;
   }
   ```

   - It renders a centred column on a `rounded-surface border bg-surface p-surface` panel: a 40px tone icon chip (`aria-hidden`), the heading (`text-title` at level 1, `text-heading` otherwise), the description (`text-sm text-ink-muted`), and then an actions row (`flex flex-wrap justify-center gap-inline`) holding `actions` then `back`.
   - The `role` is left to the caller. A boundary is a page, not a live alert.
2. **Boundaries:**
   - `[locale]/error.tsx` (web and portal) keep their full-screen `<main>` wrapper, with an `ErrorState` at level 1 and `<Button onClick={reset}>` inside.
   - `not-found.tsx` (locale and root, both apps) keep their wrappers (root keeps `<html>`/`<body>`), with an `ErrorState tone="neutral"` at level 1 whose `back` is the existing `<Link>`, now styled as a `Button variant="outline"` via `asChild`.
   - The new web `(agent)/error.tsx` is a client boundary: the same Sentry capture and `console.error` as the locale one, and **no `<main>`**, because the shell's `<main>` wraps it. It renders an `ErrorState` at level 1 with a retry (`reset`) and a back-to-tickets link.
3. **Detail views:**
   - `isError` returns `<ErrorState headingLevel={1} title={notFound ? t("detail.notFound") : t("detail.loadError")} tone={notFound ? "neutral" : "danger"} actions={!notFound && <Button onClick={() => void query.refetch()}>{tCommon("errorBoundary.retry")}</Button>} back={<BackLink asChild><Link href=…>{t("detail.backToList")}</Link></BackLink>} />`.
   - It uses the same strings as before, plus the existing retry and back strings.
4. **Business hours:**
   - The loading and error early returns are wrapped as `<section className="flex flex-col gap-6"><PageHeader title headingLevel={hosted ? 2 : 1} />…</section>`.
   - The error `Alert` gains a `Button variant="outline" size="sm"` retry (`calendarQuery.refetch`), the same pattern as the branch section.
5. **Branches (`:54`):** already satisfied by Story 198. No change.

---

## Context — Read These Files First

1. Web and portal `src/app/[locale]/error.tsx`, `src/app/[locale]/not-found.tsx` and `src/app/not-found.tsx`, plus their specs.
2. `apps/web/src/app/[locale]/(agent)/layout.tsx`, which shows how the shell wraps `children`.
3. `apps/web/src/components/customers/customer-detail-view.tsx` ~520–532; `knowledge-base/article-detail-view.tsx` ~128–138; portal `tickets/ticket-detail-view.tsx` ~105–110; portal `knowledge-base/article-detail-view.tsx` ~44–49. Each view's existing `BackLink` usage, and its specs' error cases.
4. `apps/web/src/components/business-hours/business-hours-view.tsx` ~454–482 (+ spec).
5. `packages/ui/src/components/alert.tsx` (tone icons), `badge.tsx`, `back-link.tsx`.

---

## Tasks

1. **`packages/ui/src/components/error-state.tsx`**, plus a spec and an index export.
2. **The six boundary and not-found files**, plus the new `(agent)/error.tsx` and its spec (copy, `reset`, Sentry, no `<main>`).
3. **The four detail views**, plus spec additions:
   - an `h1` on error;
   - retry calls `refetch` for a 500 and is absent for a 404;
   - the back link's `href`.
4. **Business hours**, plus spec additions: an `h1` in the loading and error states, and retry calls `refetch`.

---

## Verification Steps

1. ui, web and portal tests, typecheck and lint; prettier only on changed files that were clean at HEAD.
2. Web and portal builds (`not-found-css.spec` needs a fresh build).
3. Harness, en/ar at 320 and 1280:
   - an unknown route (not-found) in both apps;
   - a bad customer id and a bad KB id (web), plus a bad ticket id and a bad KB slug (portal): `h1` count, the back link and 0 overflow;
   - the in-shell boundary can't be triggered without a code fault, so it is verified by spec only, and that is stated.
4. Run `git diff --check`; commit path-scoped (a concurrent session's unrelated changes are in the worktree); confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] `ErrorState` in `@crm/ui`, with a spec.
- [ ] `(agent)/error.tsx` renders inside the shell.
- [ ] Six boundary and not-found files migrated; their existing specs green.
- [ ] Four detail error states have an `h1`, a back link and a retry for non-404 errors.
- [ ] Business hours has an `h1` in every state and a retry on error.
- [ ] Tests, typecheck, lint and builds pass; harness 0 overflow.
