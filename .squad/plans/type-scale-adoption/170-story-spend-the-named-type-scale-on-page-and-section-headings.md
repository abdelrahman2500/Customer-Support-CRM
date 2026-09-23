# Story 170 — Spend the named type scale on page and section headings

---

## Prerequisites

- **Story 134** completed — defined the seven-step `fontSize` scale (`caption`, `label`, `body-sm`, `body`, `subhead`, `heading`, `title`) in `packages/config/tailwind-preset.js` and deliberately applied none of it.
- **Story 140** completed — `PageHeader`, which standardised _which_ element is a page title without revisiting its size.
- **Story 154** completed — `CardTitle` and `SectionCard`, which standardised section headings on `text-sm font-semibold text-ink`.
- **Story 168** completed (`d7fbbcb`) — the login `h1`, the scale's first and so far only consumer (`text-title`).
- **Story 169** completed (`c66d1d8`) — no dependency; this story starts from its HEAD.

---

## Story Goal

Give the product a real heading hierarchy by pointing its two shared heading components at the named scale that was defined for exactly this and never spent.

User-visible outcomes:

1. Page titles step up from 1.125rem to **1.5rem** (`text-title`) — the size the redesigned login already uses, so every screen now agrees with it.
2. Section titles step up from body size (0.875rem) to **1rem** (`text-subhead`), so a section heading no longer reads as body text.
3. The three inline-editable detail titles (ticket subject, customer display name, KB article title) match the new page-title size in **both** their read and edit states, so switching into edit does not resize the heading.

**Not in scope:** any other step of the scale (`caption`, `label`, `body-sm`, `body`, `heading` stay unused); body copy; `Badge`, `Alert`, `Button` or table typography; spacing, colour or elevation; any call-site layout change; any new component, prop or token; i18n; backend.

---

## Context — Read These Files First

1. `packages/config/tailwind-preset.js` — **~lines 130–147**. The `fontSize` block and the comment that commissions this story: "…which is why pages read flat. These steps give later stories somewhere to go… applying them is a shared `PageHeader`'s job (NAV-2)." Note each step's tuple: `subhead` is `["1rem", { lineHeight: "1.5", fontWeight: "600" }]` and `title` is `["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" }]` — **both already carry the weight**.
2. `packages/ui/src/components/page-header.tsx` — **~lines 49–63**. The `h1` is **line 58**: `className="text-lg font-semibold text-ink"`. Read the doc comment at **~lines 13–17**, which explicitly records that keeping `text-lg` was a consistency decision and that "Revisiting the type scale itself is a separate, deliberate decision" — this story is that decision.
3. `packages/ui/src/components/card.tsx` — **~lines 95–109**. `CardTitle` is **line 108**: `cn("text-sm font-semibold text-ink", className)`. `SectionCard` (**~lines 173–194**) renders through it, so it needs no edit of its own.
4. `packages/ui/src/components/card.spec.tsx` — **~lines 105–112**, `it("keeps its token classes at every level")`, which asserts `toHaveClass("text-sm", "font-semibold", "text-ink")`. This assertion is the story's own change and must be updated, not deleted.
5. `packages/ui/src/components/page-header.spec.tsx` — the whole file. It asserts structure (single `h1`, `banner` landmark, description, actions, `min-w-0`) and **no** class on the heading, so it needs no edit; add the new assertion beside the existing ones.
6. The three hand-rolled page titles, each with a read `h1` and an inline-edit `Input` that must match it:
   - `apps/web/src/components/tickets/ticket-detail-view.tsx` — `Input` **~line 328** (`className="w-full max-w-xl text-lg font-semibold"`), `h1` **~line 363**.
   - `apps/web/src/components/customers/customer-detail-view.tsx` — `Input` **~line 573** (`className="w-56 text-lg font-semibold"`), `h1` **~line 605**.
   - `apps/web/src/components/knowledge-base/article-detail-view.tsx` — `Input` **~line 196** (`className="w-full max-w-md text-lg font-semibold"`), `h1` **~line 228**.
     These are the **only** production `text-lg` occurrences in either app — measured, six lines across three files.
7. `apps/web/src/design-tokens.spec.ts` — **~lines 178** and **~lines 223–300**. `SECTION_HEADING` matches the _hand-rolled_ `<h2 className="text-sm font-semibold text-ink">` string in app files, not `CardTitle`'s own class, and its fixtures are inline strings inside the spec. It is unaffected by this story and **must not be edited**. Same for the portal twin at **~line 186**.

---

## Product rules (from story)

|                                                    | Current                                | New                                          |
| -------------------------------------------------- | -------------------------------------- | -------------------------------------------- |
| Page title (37 `PageHeader` consumers)             | `text-lg font-semibold` — 1.125rem/600 | `text-title` — 1.5rem/600, tracking −0.015em |
| Section title (29 `CardTitle`/`SectionCard` files) | `text-sm font-semibold` — 0.875rem/600 | `text-subhead` — 1rem/600                    |
| Inline-editable detail title, read state (×3)      | `text-lg font-semibold`                | `text-title`                                 |
| Inline-editable detail title, edit state (×3)      | `text-lg font-semibold` on the `Input` | `text-title` on the `Input`                  |
| Login `h1`                                         | `text-title` (Story 168)               | **Unchanged**                                |
| Body copy, descriptions, badges, tables            | body size                              | **Unchanged**                                |
| Heading levels / landmarks / `min-w-0` / wrapping  | as shipped                             | **Unchanged**                                |

---

## Frontend Tasks

**No backend changes required.**

### 1 — `PageHeader`

**File: `packages/ui/src/components/page-header.tsx`**

Change the `h1`'s class from `"text-lg font-semibold text-ink"` to `"text-title text-ink"`. Drop `font-semibold`: `title`'s own `fontSize` tuple supplies `fontWeight: 600`, so keeping both would state the weight twice and let them drift.

Replace the doc comment's `text-lg` paragraph (**~lines 13–17**) with one recording that Story 170 took the deliberate decision that paragraph deferred, and why 1.5rem: it is the step Story 134 named `title`, and the redesigned login already reads at it.

**Do not** change the `<header>` landmark, the `min-w-0` title block, the description's `mt-1 text-sm text-ink-subtle`, the actions row, or `PageHeaderProps`.

### 2 — `CardTitle`

**File: `packages/ui/src/components/card.tsx`**

Change `CardTitle`'s class from `"text-sm font-semibold text-ink"` to `"text-subhead text-ink"`, dropping `font-semibold` for the same reason. Update the component's own doc comment (**~lines 95–106**), which opens by naming `text-sm font-semibold` as "the size and weight this app's section headings already use" — that sentence becomes false.

**Do not** change `CardTitleLevel`, the `as` prop, the `h3` default, `SectionCard`, `CardHeader`, `CardDescription`, `CardContent`, `CardFooter` or `Card` itself.

### 3 — The three inline-editable detail titles

**Files:** `apps/web/src/components/tickets/ticket-detail-view.tsx`, `apps/web/src/components/customers/customer-detail-view.tsx`, `apps/web/src/components/knowledge-base/article-detail-view.tsx`.

In each, replace `text-lg font-semibold` with `text-title` in **both** places — the editing `Input`'s `className` and the read-state `h1`'s `className` — keeping every other class on those elements (`w-full max-w-xl`, `w-56`, `w-full max-w-md`, `text-ink`) exactly as it is.

Both halves must move together. Changing only the `h1` would make the heading jump size the moment the agent clicks Edit, which is the layout shift Story 156 built these pairs to avoid.

**Do not** touch the edit/save/Escape logic, the focus restoration Story 166 added, the `PATCH` calls, or anything else in these files.

### 4 — No other file changes

No new component, prop, token or export. No call site of `PageHeader` or `SectionCard` is edited. No `tailwind-preset.js` or `tailwind-tokens.css` change — every class used here already resolves.

---

## Edge Cases & Failure Modes

- **A long page title at a narrow viewport.** 1.5rem is a third larger, so a free-text title (a customer name, an article title) takes more room. `PageHeader` already carries `min-w-0` on the title block and stacks above `sm`, which is the mechanism Story 140 added for exactly this; nothing new is needed, but verification step 5 checks it at 320px.
- **A section heading beside a trailing action.** `SectionCard`'s `actions` row is `flex items-start justify-between` with `shrink-0` on the actions — a 1rem heading does not change which side yields. Verified visually in step 6.
- **The weight could silently change.** It cannot: both scale steps declare `fontWeight: 600`, which is what `font-semibold` also is. Asserted in the two primitive specs by checking the class is present rather than by reading computed styles, which jsdom cannot resolve for Tailwind classes.
- **`text-title` and `text-subhead` must actually be emitted.** Both apps' `tailwind.config.ts` already include `../../packages/ui/src` in `content`, and Story 168 proved `text-title` reaches the built CSS. Re-checked for `text-subhead` in verification step 4 — a missing utility would silently render at the inherited size, which no unit test can see.
- **Arabic.** `title` carries `letterSpacing: -0.015em`. Small negative tracking does not break Arabic joining (Story 168 established this on the login `h1`); `subhead` declares no tracking at all.
- **The `design-tokens.spec.ts` section-heading guards.** They match a hand-rolled string in app files, not `CardTitle`'s own class, so they stay green and stay meaningful. If either needs editing, the implementation has drifted — a `CardTitle` edit cannot reach them.
- **A call site that already passes its own size via `className`.** `CardTitle` merges through `cn`, so a caller's later class still wins. Measured: no call site passes a `text-*` size to either component today, so nothing silently overrides the new step.

---

## Test Plan

1. **`packages/ui/src/components/card.spec.tsx`** — update `it("keeps its token classes at every level")` to assert `toHaveClass("text-subhead", "text-ink")` and, explicitly, `not.toHaveClass("text-sm")`. Keep the existing raw-palette guard line unchanged. The negative assertion is what makes this a regression test rather than a restatement.
2. **`packages/ui/src/components/page-header.spec.tsx`** — add `it("types the page title at the named title step")`: the level-1 heading `toHaveClass("text-title", "text-ink")` and `not.toHaveClass("text-lg")`. Place it beside the existing structural tests; change none of them.
3. **`packages/ui/src/components/card.spec.tsx`** — add a `SectionCard` case asserting its rendered `h2` inherits the same `text-subhead`, so the 29 files that go through `SectionCard` rather than `CardTitle` directly are covered by something.
4. **No app spec should need editing.** Measured: zero specs in either app assert `text-lg` or a heading's class. If one fails, read it before touching it — a failure there means the change reached something this plan did not intend.
5. **Regression, by count.** The three app suites must come back at their current totals plus only the new `packages/ui` cases: `@crm/ui` **269**, `@crm/web` **1266**, `@crm/portal` **403** at HEAD `c66d1d8`.

---

## Verification Steps

1. **Frontend runs:** `pnpm --filter @crm/ui test` — expect **269 + 3**, 0 failures.
2. **Regression:** `pnpm --filter @crm/web test` (**1266**) and `pnpm --filter @crm/portal test` (**403**), both expected unchanged.
3. **Backend builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` from the repository root.
4. **Regression — the utilities exist:** after the build, `grep -ho "\.text-title{[^}]*}\|\.text-subhead{[^}]*}" apps/web/.next/static/css/*.css | sort -u` prints both, with `font-weight:600` on each.
5. **Manual — desktop and 320px:** `pnpm --filter @crm/web dev`, then `/en/tickets` (a `PageHeader` list screen), `/en/dashboard` (many `SectionCard`s) and `/en/tickets/<id>` (a hand-rolled editable `h1`). Confirm the new hierarchy reads, no title is clipped, and no action is pushed off-screen at 320px.
6. **Manual — the edit pair:** on a ticket detail, click Edit on the subject. The heading must not change size between read and edit.
7. **Manual — RTL:** `/ar/tickets` and `/ar/tickets/<id>`. Confirm Arabic headings render correctly at both new steps.
8. **Regression — scope:** `git status --short` shows exactly 5 production/spec files plus this plan folder and the index row. Nothing under `apps/api`, `packages/config`, `messages/`, `package.json` or the lockfile.
9. **Re-scan:** `grep -rn "text-lg" apps/web/src apps/portal/src packages/ui/src --include=*.tsx | grep -v spec` returns **no** match.

---

## Done Criteria

- [ ] `PageHeader`'s `h1` renders `text-title text-ink`, with no `font-semibold` and no `text-lg`.
- [ ] `CardTitle` renders `text-subhead text-ink`, with no `font-semibold` and no `text-sm`.
- [ ] All three inline-editable detail titles use `text-title` in both their read `h1` and their editing `Input`, with every other class preserved.
- [ ] No production `text-lg` remains in either app or in `packages/ui`.
- [ ] No call site of `PageHeader`, `SectionCard` or `CardTitle` was edited; no prop, export or token added or changed.
- [ ] Both primitives' doc comments no longer claim the superseded sizes.
- [ ] `card.spec.tsx` and `page-header.spec.tsx` assert the new steps positively **and** assert the old class is gone; no existing test weakened, skipped or deleted.
- [ ] `text-title` and `text-subhead` both appear in the built CSS with `font-weight:600`.
- [ ] `@crm/ui` +3 tests, web and portal unchanged; typecheck, lint, build green; both `design-tokens.spec.ts` guards pass unedited.
