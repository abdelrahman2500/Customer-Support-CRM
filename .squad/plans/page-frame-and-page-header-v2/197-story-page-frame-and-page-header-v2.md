# Story 197 — Page frame and PageHeader v2

> CRM UI/UX redesign roadmap item **RD-2.3**. Intake: [`../../stories/page-frame-and-page-header-v2/page-frame-and-page-header-v2/intake.md`](../../stories/page-frame-and-page-header-v2/page-frame-and-page-header-v2/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 2 "RD-2.3".

---

## Prerequisites

- Story 179 (RD-1.2): the `page-x`/`page-y` spacing tokens. They are 1rem, then 1.5rem from 640px, then 2rem from 1024px.
- Story 189 (RD-1.12): `BackLink`, the intended content of the `back` slot.

---

## Story Goal

1. **Page frame.** Both apps' `<main>` replace `p-6` (24px at every width) with `px-page-x py-page-y`. Phones get 16px gutters; desktops grow to 32px.
2. **PageHeader v2.** Add three additive slots; `title`, `description`, `actions` and `className` are unchanged:
   - `back`: rendered above the title row;
   - `meta`: a wrapping row under the title and description, for badges, ids or timestamps;
   - `tabs`: full width below the row.

**Non-goals:**
- adopting the slots or moving PageHeader on pages (RD-2.4 and later)
- any change for callers that don't pass the new slots
- backend changes

---

## Design decisions

1. **No structural change without the new slots.** When neither `back` nor `tabs` is passed, PageHeader renders exactly today's tree: the root `<header>` is the responsive row. Every one of the 35 callers is byte-identical, and the existing spec stays untouched.
2. **With `back` or `tabs`:**
   - the root `<header>` becomes `flex flex-col gap-stack`, with `className` still on the root;
   - it renders `back` in a `flex` wrapper, so a `BackLink` keeps its intrinsic width;
   - then the same row: title block plus actions;
   - then `tabs` in a `min-w-0` wrapper, so a tab list can scroll inside it.
3. **`meta`** sits inside the title block, after the description: `mt-2 flex flex-wrap items-center gap-inline text-sm text-ink-muted`. It works with or without `back`/`tabs`, and adding it changes only the title block.
4. **The single `h1` stays.** The slots render caller content. The doc comment states that `back`, `meta` and `tabs` must not contain headings above `h2`.
5. **Actions** keep `shrink-0 flex-wrap`, unchanged.

---

## Context — Read These Files First

1. `packages/ui/src/components/page-header.tsx` (+ `page-header.spec.tsx`).
2. `apps/web/src/components/workspace/workspace-shell.tsx` ~92–95 (`<main>`), and `workspace-shell.spec.tsx` ~154 (`min-w-0`).
3. `apps/portal/src/app/[locale]/(customer)/layout.tsx` ~42.
4. `packages/config/tailwind-tokens.css` ~277 and ~478–489 (the page tokens).

---

## Tasks

1. **PageHeader:** add the props and rendering per the design decisions; update the doc comment with Story 197.
2. **Web shell:** `<main id="main-content" className="min-w-0 flex-1 px-page-x py-page-y">`.
3. **Portal layout:** `<main id="main-content" className="flex-1 px-page-x py-page-y">`.
4. **Specs:**
   - `page-header.spec.tsx` new cases:
     - `back` renders before the `h1`;
     - `meta` renders after the description, inside the title block;
     - `tabs` render after the row;
     - there is still exactly one `h1` with all slots;
     - without `back`/`tabs` the root is still the row;
     - no physical classes with all slots.
   - Shell spec: main has `px-page-x` and `py-page-y` (a new assertion).

---

## Verification Steps

1. ui, web and portal tests, typecheck and lint; prettier only on the changed files.
2. Web and portal builds.
3. Harness at 320, 768 and 1280 × en/ar on a web page and a portal page:
   - the `<main>` computed padding is 16, 24 and 32px;
   - 0 overflow;
   - screenshots.
4. Run `git diff --check`, review the diff, and confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] Responsive page gutters in both apps.
- [ ] PageHeader `back`/`meta`/`tabs`; existing callers unchanged; single `h1`.
- [ ] Specs extended; ui, web and portal tests, typecheck, lint and builds pass; 0 overflow.
