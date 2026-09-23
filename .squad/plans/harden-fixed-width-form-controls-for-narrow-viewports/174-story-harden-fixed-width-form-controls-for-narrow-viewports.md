# Story 174 — Harden fixed-width form controls for narrow viewports

---

## Prerequisites

- **Story 173** completed (`dee4256`) — fixed the workspace shell below `sm`. Its own verification sweep surfaced this story's defect. No code dependency.
- **Story 150** ("Responsive quality pass") — investigated and rejected filter rows on evidence that still holds. This story extends that scan to a class it never covered; it does **not** reopen that decision.
- **RM-10** — `FilterBar` and the mobile table primitive, the wrapping containers that keep `min-w-*` safe. Untouched here.
- **Story 170** — introduced `w-56 text-title` on the customer inline-edit heading input, one of the sites this story guards.
- Precedent for tone and structure: [`../make-the-agent-workspace-header-safe-below-sm/173-story-make-the-agent-workspace-header-safe-below-sm.md`](../make-the-agent-workspace-header-safe-below-sm/173-story-make-the-agent-workspace-header-safe-below-sm.md).

---

## Story Goal

Make every fixed-width form control in `apps/web` shrink on a narrow viewport, closing the last measured 320px overflow and the whole class behind it.

User-visible outcomes:

1. `/quick-replies` no longer overflows horizontally at 320px, EN or AR.
2. Every fixed-width form control fills the available width below `sm` instead of forcing a scrollbar.
3. Nothing changes at `sm` and above.

**Not in scope:** `Skeleton` widths; the mention-autocomplete popover; `min-w-[10rem]` filter selects (Story 150's rejected candidate); the portal; new tokens, primitives or dependencies; anything at ≥640px.

---

## Context — Read These Files First

1. `apps/web/src/components/quick-replies/quick-replies-view.tsx` — **the proven defect**. Read **lines 185–205**: `SectionCard` opens at **186**, the always-visible `<form>` at **187**, and the offending `<Input … className="w-72" />` at **lines 190–196** (the class is on **line 195**). Measured at 320px: input 288px inside a 272px card, `scrollWidth` 329 vs `clientWidth` 320, identically in EN and AR.
2. `packages/ui/src/components/filter-bar.tsx` — **line 64**, `<SelectTrigger className="w-full sm:w-auto sm:min-w-[10rem]" …>`. **This is the idiom to copy.** Also **line 18**, `flex flex-col gap-stack sm:flex-row sm:flex-wrap` — why `min-w-*` filter controls are already safe and must not be touched.
3. `apps/web/src/components/tickets/ticket-list-view.tsx` — **line 281**, and `apps/web/src/components/customers/customer-list-view.tsx` — **lines 172 and 185**: three existing call sites already using the guarded form. Match them.
4. `apps/web/src/components/workspace/workspace-shell.tsx` — **line 85**, `<main id="main-content" className="min-w-0 flex-1 p-6">`. `p-6` is where the 272px content box at a 320px viewport comes from.
5. `packages/ui/src/components/card.tsx` — **line 183**, `SectionCard` renders `<Card className={cn("p-surface", className)}>`. `p-surface` is 1rem, which is why a control inside a card has 240px, not 272px.
6. `apps/web/src/components/quick-replies/quick-replies-view.spec.tsx` — the existing spec for the proven file; the new structural test goes here.
7. Intake: `.squad/stories/harden-fixed-width-form-controls-for-narrow-viewports/harden-fixed-width-form-controls-for-narrow-viewports/intake.md` — carries the full 25-site inventory and the width table.

---

## Product rules (from story)

| | Current | New |
|---|---|---|
| Fixed-width form control below `sm` | fixed px, cannot shrink | full width of its container |
| Same control at `sm` and above | fixed px | **unchanged** — same fixed px |
| `Skeleton` placeholders | fixed px | **unchanged** |
| Mention-autocomplete popover (`w-56`) | fixed px | **unchanged** |
| `min-w-[10rem]` filter selects | wrap via `FilterBar` | **unchanged** |
| `/quick-replies` at 320px | 329 / 320 | 320 / 320 |

---

## Frontend Tasks

**No backend changes required.** No `apps/api`, no schema, no DTO, no migration, no `package.json`, no token or preset change.

### Design decision

One mechanical transform, applied to form controls only: **`w-N` → `w-full sm:w-N`**, preserving every other class on the element and its order otherwise.

This is provably inert at ≥640px — once `sm` is active, `sm:w-N` wins over `w-full`, giving the exact width the element has today. Below `sm` the control fills its container instead of overflowing it. It introduces no new class vocabulary: `w-full sm:w-*` is already in the repository at six sites.

### 1 — The proven defect

**File: `apps/web/src/components/quick-replies/quick-replies-view.tsx`**

Line **195**: `className="w-72"` → `className="w-full sm:w-72"`.

### 2 — The remaining fixed-width form controls

Apply the same transform to each. **25 controls across 12 files** — do not alter anything else on these lines:

| File | Controls |
|---|---|
| `audit-logs/audit-log-view.tsx` | `w-40` ×2 (lines ~157, ~166) |
| `automation-rules/automation-rules-view.tsx` | `w-56` ×3, `w-40` ×4 (lines ~347–442) |
| `branches/branch-departments-view.tsx` | `w-56` (line ~343) |
| `business-hours/business-hours-view.tsx` | `w-40` (line ~376) |
| `customers/customer-detail-view.tsx` | `w-40` ×3 (lines ~113, ~161, ~303), `w-56 text-title` (line ~573) |
| `kb-categories/kb-categories-view.tsx` | `w-56` (line ~224) |
| `notifications/notification-templates-view.tsx` | `w-48` (line ~171) |
| `quick-replies/quick-replies-view.tsx` | `w-72` (line 195 — task 1) |
| `reporting/reports-view.tsx` | `w-40` ×2, `w-56` (lines ~600, ~611, ~746) |
| `roles/role-list-view.tsx` | `w-40`, `w-56` (lines ~131, ~258) |
| `ticket-categories/ticket-categories-view.tsx` | `w-56` (line ~227) |
| `tickets/ticket-chat-card.tsx` | `w-64` (line ~258) |

For `customer-detail-view.tsx` line ~573 the result is `className="w-full sm:w-56 text-title"` — the Story 170 type-scale class is preserved untouched.

### 3 — What must NOT change

- **`Skeleton`** elements: `customer-detail-view.tsx` ~434, `ticket-detail-view.tsx` ~175, ~697, ~835. Decorative placeholders; a full-width skeleton would misrepresent the control it stands in for.
- **The mention-autocomplete `<ul>`**: `ticket-detail-view.tsx` ~953, `absolute … w-56`. A positioned popover, not a control in flow.
- **`min-w-[10rem]` filter selects** (11 sites). Story 150 rejected these on evidence that still holds; `FilterBar` stacks them full-width below `sm` already.
- **`apps/portal`** — its one fixed width (`sm:w-64`, `portal/src/components/tickets/ticket-list-view.tsx` ~145) is already guarded.

---

## Edge Cases & Failure Modes

- **A control already inside a `flex` row with siblings.** Trigger: `automation-rules-view.tsx`'s condition/action builders. Expected: below `sm` each control takes the row's full width; the row must already wrap or stack, otherwise full-width children compete. **Verify in the browser** — these builders are behind interactions the route sweep never opens, so they are the least-covered sites in this story.
- **`w-full` inside a container that is itself too narrow.** Full width of an overflowing parent still overflows. The parent chain here is `<main class="min-w-0 … p-6">` → `SectionCard p-surface`, both already bounded, which is why the transform is sufficient for the proven case.
- **Table-cell controls.** Some sites sit inside `TableCell`, which below `sm` renders as a stacked card (RM-10). Full width there is correct and is what the neighbouring RM-10 controls already do.
- **The inline-edit heading input** (`customer-detail-view.tsx` ~573) becomes full-width below `sm` while its read-state `h1` is block-level anyway, so the read↔edit swap stays the same height. Story 173's own criterion — no size jump on Edit — is unaffected because `text-title` is untouched.
- **Ordering of `w-full` and `sm:w-N`.** Tailwind emits unprefixed utilities before `sm:` variants, so `sm:w-N` wins at ≥640px regardless of the order written in the string. Confirmed by the six existing call sites behaving correctly today.
- **jsdom cannot measure any of this.** No Tailwind CSS is loaded in the test environment, so the unit test is class-level and the real proof is the browser sweep — the pattern already recorded in `packages/ui/src/lib/cn.spec.ts`, Story 169 and Story 173.

---

## Test Plan

1. **`apps/web/src/components/quick-replies/quick-replies-view.spec.tsx`** — add one focused test asserting the title `Input` carries **both** `w-full` and `sm:w-72`, and **not** a bare `w-72`. The negative assertion is what makes it a regression test rather than a restatement.
2. **Do not modify any existing test.** The transform changes no behaviour, no accessible name, no value and no handler, so every existing assertion must pass untouched.
3. **No Playwright infrastructure**, per the intake.

---

## Verification Steps

1. **Frontend runs:** `pnpm --filter @crm/web test` from the repository root. Baseline at `dee4256` is **86 files / 1272 tests**; expect 1272 + 1.
2. **Regression:** `pnpm --filter @crm/portal test` (**414**) and `pnpm --filter @crm/ui test` (**312**), both expected unchanged — nothing outside `apps/web` is touched.
3. **Backend builds:** `pnpm typecheck`, then `pnpm lint`, then `pnpm build`.
4. **Browser — the acceptance criterion.** Force-rebuild (`pnpm exec turbo run build --filter=@crm/web --force`), start the API and web, sign in, and re-run the 23-route × EN/AR sweep at 320×640 comparing `scrollWidth` to `clientWidth`. Expect **23/23 clean in both locales** (currently 22/23 each).
5. **Browser — no regression above `sm`:** spot-check 834 and 1440, EN and AR, on `/quick-replies` and one builder-heavy route.
6. **Regression — scope:** `git status --short` shows only this story's files. No `apps/api`, `apps/portal`, `packages/**`, `messages/**`, `package.json` or lockfile change.
7. **Re-scan:** `grep -rnE 'className="[^"]*\bw-(40|48|56|64|72)\b' apps/web/src --include=*.tsx | grep -v spec | grep -viE "skeleton|<ul"` returns only lines that also contain `w-full sm:`.

---

## Done Criteria

- [ ] `/quick-replies` reports `scrollWidth === clientWidth` at 320×640 in EN and in AR.
- [ ] The 23-route × EN/AR sweep reports 23/23 clean in both locales.
- [ ] All 25 fixed-width form controls carry `w-full sm:w-N`.
- [ ] No `Skeleton`, popover or `min-w-*` filter control was altered.
- [ ] 834 and 1440 unchanged, EN and AR.
- [ ] No physical-direction utility; no new token, primitive or dependency.
- [ ] Existing tests pass unmodified; one new class-level test added.
- [ ] web / portal / ui suites, typecheck, lint and build green; diff limited to this story.
