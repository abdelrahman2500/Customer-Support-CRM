# Story 166 — Restore focus and strengthen menu focus indicators

---

## Prerequisites

- **Story 94** — `ConfirmDialog` (`packages/ui/src/components/confirm-dialog.tsx`), the repository's only existing capture-and-restore focus precedent. Its `previouslyFocusedRef` + `onCloseAutoFocus` pair is the pattern this story follows.
- **Story S-1 / DS-A** — `.focus-ring` and `.focus-ring-always` in `packages/config/tailwind-tokens.css` (~lines 292–320). `.focus-ring-always` already names "the select trigger, menu items" as its intended consumers.
- **Story S-3** — `packages/ui/src/lib/menu.ts`, the shared class strings for `DropdownMenu`, `Popover` and `Select`.
- **Story 156** (ticket subject) and **Story 159** (customer display name, KB title) — the three inline edit modes whose exit path this story completes.
- **Story 165** completed — the preceding accessibility thread. No code dependency; this story starts from its HEAD.

---

## Story Goal

Two defects, one accessibility theme — keyboard focus that the user can see and never loses.

1. **Focus restoration.** Four controls remove themselves from the DOM while focused and leave focus on `document.body`: the three inline-edit `Input`s (ticket subject, customer display name, KB article title) on their Escape and Enter/save exits, and the Reports "Save current view" form's own Save and Cancel buttons. Each gains an explicit restore to the persistent control that logically owns it.
2. **Menu/select focus indicator.** `menuItemClassName` removes the native outline and indicates focus only with `focus:bg-surface-muted`. Measured against the token values in `packages/config/tailwind-tokens.css` (`--surface: 255 255 255`, `--surface-muted: 241 245 249`) that is **1.10:1**, below WCAG 2.4.11's 3:1 focus-indicator threshold. The item adopts the repository's existing `.focus-ring-always`.

**Not in scope:** the portal CSAT radiogroup (a separate ARIA composite-widget concern, deferred by the intake), arrow-key/roving-tabindex behaviour, Radix `RadioGroup` adoption, `Button isLoading`/disabled-focus behaviour, route-change focus, any new focus-management primitive or shared hook, any new or changed colour/surface token, general keyboard-accessibility cleanup, backend, RBAC, routing, i18n keys.

---

## Context — Read These Files First

1. `packages/ui/src/components/confirm-dialog.tsx` — **~lines 78–90 and 107–110**. `previouslyFocusedRef` is a plain `useRef<HTMLElement | null>`, populated in a `useEffect` and consumed by an explicit `.focus()` call. Note the doc comment's reason for doing it by hand rather than leaning on Radix. This is the precedent; there is no shared hook to reuse and this story does not create one.
2. `packages/ui/src/lib/menu.ts` — the whole file (28 lines). `menuItemClassName` is **~lines 22–23**; it carries an unconditional `outline-none` and `focus:bg-surface-muted`.
3. `packages/config/tailwind-tokens.css` — **~lines 81–83** for `--surface` / `--surface-sunk` / `--surface-muted`, **~line 130** for `--focus: 29 78 216` and its own documented "6.3:1" contrast note, and **~lines 292–320** for `.focus-ring` / `.focus-ring-always`. There is no dark-theme block; the palette is single-mode.
4. `packages/ui/src/components/select.tsx` — **~line 20** (`SelectTrigger` already leads its `cn` with `focus-ring-always`), **~lines 100–118** (`SelectContent` sets `p-0` on the panel and `p-1 overflow-y-auto` on the `Viewport`), **~lines 122–140** (`SelectItem` composes `menuItemClassName` with only `data-[state=checked]:font-medium`).
5. `packages/ui/src/components/dropdown-menu.tsx` — **~lines 34–46** (`DropdownMenuContent` → `menuContentClassName`, which carries `p-1 overflow-y-auto overflow-x-hidden`) and **~lines 57–67** (`DropdownMenuItem` composes `menuItemClassName` with only `destructive && "text-danger-foreground"`).
6. `packages/ui/src/lib/cn.ts` — 9 lines. `twMerge(clsx(...))`. `focus-ring-always` is a custom component class, not a Tailwind utility, so tailwind-merge never strips it; confirm no consumer passes a competing `ring-*` class (none does — see 4 and 5).
7. `apps/web/src/components/tickets/ticket-detail-view.tsx` — **~lines 228–232** (the `subjectDraft` / `editingSubject` state, declared **above** the `isLoading` early return at ~line 247) and **~lines 300–344** (the `editingSubject ? <Input autoFocus …> : <Button … onClick={() => setEditingSubject(true)}>` pair). Read the `onKeyDown` Escape branch and the `onBlur` commit carefully — Enter calls `event.currentTarget.blur()`, which is what routes Enter through `onBlur`.
8. `apps/web/src/components/customers/customer-detail-view.tsx` — **~lines 475–478** (state, above the early return at ~line 489) and **~lines 544–586** (the same `Input`/`Button` pair, `displayNameDraft` / `editingName` / `detail.displayNameEdit`).
9. `apps/web/src/components/knowledge-base/article-detail-view.tsx` — **~lines 94–98** (state, above the early return at ~line 99) and **~lines 169–210** (`titleDraft` / `editingTitle` / `detail.titleEdit`).
10. `apps/web/src/components/reporting/reports-view.tsx` — **~line 191** (`showSaveForm`), **~lines 224–238** (`handleSaveCurrentView`, which is `async` and calls `setShowSaveForm(false)` after its `await`), **~lines 685–687** (the persistent `dashboards.saveCurrentView` trigger `Button`), and **~lines 712–747** (the conditional `Card` whose Save and Cancel buttons both unmount themselves).
11. `packages/ui/src/components/select.spec.tsx` — **~lines 140–148**, `"keeps the trigger's own token styling and shared focus treatment"`. The exact assertion shape (`toHaveClass("focus-ring-always")` plus a `not.toMatch(/slate-\d/)` guard) the new item tests mirror.
12. `packages/ui/src/lib/icons.spec.ts` — the precedent for a spec that lives beside a module in `packages/ui/src/lib/` and tests exported constants rather than a component.
13. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx` — **~lines 458–553**, `describe("subject editing (Story 42)")`. The new focus tests are added to this block and reuse its `vi.mocked(useTicketQuery)` / `queryResult(...)` setup verbatim.

---

## Product rules (from story)

| | Current behaviour | New behaviour |
|---|---|---|
| Inline edit, Escape | Input unmounts; focus falls to `document.body` | Focus returns to the "Edit" trigger `Button` |
| Inline edit, Enter/save | `.blur()` → commit → unmount; focus on `document.body` | Focus returns to the "Edit" trigger `Button` |
| Inline edit, click elsewhere | `onBlur` commits; focus is on the clicked control | **Unchanged** — focus is not stolen back |
| Reports Save / Cancel | Button unmounts itself; focus on `document.body` | Focus returns to the "Save current view" trigger |
| Menu / select item focus | `focus:bg-surface-muted` only — 1.10:1 | `.focus-ring-always` (2px `--focus` ring, 2px surface offset) **plus** the existing tint |

---

## Design decisions

### 1 — Restore only when focus was genuinely orphaned

All four restore sites use one condition: **restore only if `document.activeElement` is `null` or `document.body`**.

This is what separates the four in-scope exits from the one out-of-scope exit. Escape unmounts a focused input, and Enter's `event.currentTarget.blur()` un-focuses it before the unmount — both leave `document.body` focused, so both restore. Clicking a *different* control also fires `onBlur` and also leaves edit mode, but by then `document.activeElement` is the control the user clicked, so nothing is stolen. That satisfies the intake's "Preserve current mouse behavior" without needing a second, keyboard-only signal.

It also covers the async hazard at `reports-view.tsx` ~line 235: `handleSaveCurrentView` sets `showSaveForm` to `false` after an `await`, so if the user has moved focus in the meantime the guard declines.

### 2 — Inline, per file; no shared hook

The intake's constraint is explicit: *"Do not introduce a new focus-management abstraction unless the existing pattern genuinely cannot support the affected cases."* It can. `ConfirmDialog` solves the same problem with a bare `useRef` + `useEffect` inside the component that owns the state, and each of the four sites needs about six lines. A `useRestoreFocus` hook is therefore **not** created — the duplication is deliberate and is this decision's own justification.

### 3 — `.focus-ring-always`, not a new treatment

`packages/config/tailwind-tokens.css` documents `.focus-ring-always` as being for "components whose focus is driven by Radix's `:focus` rather than `:focus-visible` (the select trigger, menu items)". Menu items are named in the convention's own comment. `SelectTrigger` already consumes it and `select.spec.tsx` already pins that. **No token is added or changed**, and `--focus` clears 3:1 against `--surface` with room to spare (the token's own comment records 6.3:1).

### 4 — The tint stays

`focus:bg-surface-muted` is kept alongside the ring. At 1.10:1 it was never adequate *alone*, but removing it is a visual change this story has no mandate for, and a second redundant cue costs nothing. The class string's ordering follows `SelectTrigger`'s: `focus-ring-always` leads.

### 5 — The unconditional `outline-none` stays

`menuItemClassName` already carries a bare `outline-none`; `.focus-ring-always` adds `focus:outline-none`. Both resolve to the same declaration, so the overlap is inert. Removing the existing one would be an unrelated edit — leave it.

---

## Frontend Tasks

### 1 — `packages/ui/src/lib/menu.ts`

**File: `packages/ui/src/lib/menu.ts`**

Prepend `focus-ring-always` to `menuItemClassName` and extend its doc comment with the measurement that motivated it.

```ts
/** A row inside a menu. `ps-8 pe-2` leaves room at the reading-start edge
 * for a check indicator, matching `SelectItem`'s own geometry.
 *
 * Story 166 — `focus:bg-surface-muted` was the whole focus indicator, and
 * `--surface` (255 255 255) against `--surface-muted` (241 245 249) measures
 * 1.10:1, under WCAG 2.4.11's 3:1 minimum. `.focus-ring-always` is the
 * treatment `tailwind-tokens.css` already documents for exactly this case
 * ("the select trigger, menu items"), and `SelectTrigger` already uses it.
 * The tint stays as a second, redundant cue. */
export const menuItemClassName =
  "focus-ring-always relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 ps-8 pe-2 text-sm outline-none transition-colors focus:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50";
```

**Do not** touch `menuContentClassName`, `menuLabelClassName` or `menuSeparatorClassName`, and **do not** edit `dropdown-menu.tsx`, `select.tsx` or `popover.tsx` — all three consume the constant and inherit the fix.

### 2 — `apps/web/src/components/tickets/ticket-detail-view.tsx`

**File: `apps/web/src/components/tickets/ticket-detail-view.tsx`**

Add `useEffect` and `useRef` to the existing `import { useMemo, useState } from "react";` at line 3.

Beside the existing state at **~line 230** — and **above** the `ticketQuery.isLoading` early return at ~line 247, so hook order is unconditional:

```tsx
/** Story 166 — the `Input` unmounts on both exits (Escape, and Enter via
 * `blur()`), so without this focus lands on `document.body`. Guarded on
 * `document.body`: a blur caused by clicking another control has already
 * moved focus somewhere valid and must not be overridden. Mirrors
 * `ConfirmDialog`'s own hand-rolled capture-and-restore (Story 94). */
const subjectEditTriggerRef = useRef<HTMLButtonElement>(null);
/** Latches on the first entry into edit mode, so the effect's own initial
 * run — which also sees `editingSubject === false` on a page where nothing
 * is focused yet — cannot steal focus on load. */
const subjectWasEditingRef = useRef(false);

useEffect(() => {
  if (editingSubject) {
    subjectWasEditingRef.current = true;
    return;
  }
  if (!subjectWasEditingRef.current) return;
  subjectWasEditingRef.current = false;
  const active = document.activeElement;
  if (active === null || active === document.body) {
    subjectEditTriggerRef.current?.focus();
  }
}, [editingSubject]);
```

Attach the ref to the existing trigger at **~line 340** — the only change to that element:

```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  ref={subjectEditTriggerRef}
  onClick={() => setEditingSubject(true)}
>
```

`Button` is a `React.forwardRef<HTMLButtonElement, ButtonProps>` (`packages/ui/src/components/button.tsx` ~line 70), so no component change is needed.

**Do not** touch the `Input`'s `autoFocus`, its `onChange`, its `onKeyDown` branches, or its `onBlur` commit/revert.

### 3 — `apps/web/src/components/customers/customer-detail-view.tsx`

**File: `apps/web/src/components/customers/customer-detail-view.tsx`**

Identical shape. Add `useEffect`/`useRef` to the `import { useMemo, useState, type FormEvent } from "react";` at line 3. Declare `displayNameEditTriggerRef` and its effect beside `editingName` at **~line 478**, keyed on `editingName`, above the `customerQuery.isLoading` early return at ~line 489. Attach the ref to the `detail.displayNameEdit` `Button` at **~line 582**.

### 4 — `apps/web/src/components/knowledge-base/article-detail-view.tsx`

**File: `apps/web/src/components/knowledge-base/article-detail-view.tsx`**

Identical shape. Add `useEffect`/`useRef` to the `import { useState } from "react";` at line 3. Declare `titleEditTriggerRef` and its effect beside `editingTitle` at **~line 97**, above the `articleQuery.isLoading` early return at ~line 99. Attach the ref to the `detail.titleEdit` `Button` at **~line 207**.

### 5 — `apps/web/src/components/reporting/reports-view.tsx`

**File: `apps/web/src/components/reporting/reports-view.tsx`**

Add `useEffect`/`useRef` to the `import { Fragment, useState, type ReactNode } from "react";` at line 3. Beside `showSaveForm` at **~line 191**:

```tsx
/** Story 166 — both buttons inside the save form unmount the form that
 * contains them, so the activated control removes itself and focus falls to
 * `document.body`. The persistent "Save current view" trigger is the
 * disclosure's owner and the correct successor. The `document.body` guard
 * matters more here than on the detail pages: `handleSaveCurrentView` closes
 * the form only after its `await`, by which time focus may legitimately have
 * moved. */
const saveViewTriggerRef = useRef<HTMLButtonElement>(null);
const saveFormWasOpenRef = useRef(false);

useEffect(() => {
  if (showSaveForm) {
    saveFormWasOpenRef.current = true;
    return;
  }
  if (!saveFormWasOpenRef.current) return;
  saveFormWasOpenRef.current = false;
  const active = document.activeElement;
  if (active === null || active === document.body) {
    saveViewTriggerRef.current?.focus();
  }
}, [showSaveForm]);
```

Attach the ref to the persistent trigger at **~line 685**:

```tsx
<Button
  variant="outline"
  size="sm"
  ref={saveViewTriggerRef}
  onClick={() => setShowSaveForm(true)}
>
  {t("dashboards.saveCurrentView")}
</Button>
```

**Do not** change `handleSaveCurrentView`, the `Save` button's `disabled` expression, the `Cancel` button's handler, or the `ConfirmDialog` above the form — that one already restores focus itself.

### No backend changes required.

No API, DTO, Prisma, permission, route or i18n-key change. No new i18n string is introduced: every control this story focuses already has its label.

---

## Edge Cases & Failure Modes

- **Mouse user clicks another control while editing.** `onBlur` fires, edit mode exits, but `document.activeElement` is the clicked control — the guard in every effect declines and focus is left where the user put it. This is the case that rules out an unconditional restore. Enforced by the `active === document.body` condition in all four effects.
- **First render.** The effect runs on mount with the flag already `false`. On a detail page nothing else has been focused yet, so `document.activeElement` *is* `body` and the trigger would be focused on load. The `useRef(false)` "has been open" latch in every snippet above is what prevents it: it is set only when the flag turns `true`, so the initial run returns early. Assert this explicitly — a test must confirm that rendering the view does **not** focus the Edit trigger.
- **Escape while the mutation is in flight.** Escape resets the draft and exits without committing (current behaviour, unchanged). The restore still runs; the trigger is mounted by then because `setEditingSubject(false)` and the re-render are synchronous within the same React batch.
- **Enter's double state change.** Enter calls `blur()`, which fires `onBlur`, which both commits and calls `setEditing…(false)`. The effect sees one transition, not two, and `document.activeElement` is `body` because `blur()` already ran. Do not add a second restore inside the `Enter` branch.
- **Reports save rejects.** `handleSaveCurrentView` `await`s `mutateAsync`; on rejection `setShowSaveForm(false)` is never reached, the form stays open, and no restore fires. Unchanged, and correct — the user's input is still on screen.
- **Ring clipped by the menu panel.** `.focus-ring-always` paints 2px of offset plus a 2px ring = 4px outside the item's box. `DropdownMenuContent` (`menuContentClassName`, `packages/ui/src/lib/menu.ts` ~line 17) has `p-1` with `overflow-y-auto overflow-x-hidden`; `SelectContent`'s `Viewport` (`packages/ui/src/components/select.tsx` ~line 113) has `p-1 overflow-y-auto`. `p-1` is exactly 4px, so the ring fits its container precisely in both. **Do not** reduce the padding or the offset to "make room" — there is room.
- **tailwind-merge stripping the class.** `focus-ring-always` is an `@layer components` class, not a Tailwind utility, so `twMerge` passes it through. No consumer of `menuItemClassName` passes a `ring-*` or `outline-*` class that could conflict (`DropdownMenuItem` passes only `text-danger-foreground`; `SelectItem` only `data-[state=checked]:font-medium`).
- **`Popover` is unaffected.** It imports `menuContentClassName` only (`packages/ui/src/components/popover.tsx` ~line 6), never `menuItemClassName`. Its appearance must not change.
- **RTL.** Neither change introduces a physical-direction utility. The ring is symmetric; `ps-8 pe-2` is untouched.

---

## Test Plan

**Unit / component, `apps/web` (Vitest + Testing Library).** Note that React's `autoFocus` really does focus in jsdom, and jsdom resets `document.activeElement` to `body` when a focused node is removed — both behaviours the tests below depend on.

1. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx` — inside the existing `describe("subject editing (Story 42)")` block (~line 458), reusing its mock setup:
   - *"returns focus to the subject edit trigger after Escape"* — click `detail.subjectEdit`, assert the `Input` is `document.activeElement`, `fireEvent.keyDown(input, { key: "Escape" })`, assert `document.activeElement` is the `detail.subjectEdit` button.
   - *"returns focus to the subject edit trigger after Enter"* — same, with `{ key: "Enter" }`, plus an assertion that the existing commit still fired.
   - *"does not steal focus when the edit is left by focusing another control"* — enter edit mode, focus a different control, `fireEvent.blur(input)`, assert focus stayed on that control.
   - *"does not focus the subject edit trigger on first render"* — render only; assert `document.activeElement` is `document.body`.
2. `apps/web/src/components/customers/customer-detail-view.spec.tsx` — the same four, against `detail.displayNameEdit`, added beside the existing display-name editing tests (~line 436 onward).
3. `apps/web/src/components/knowledge-base/article-detail-view.spec.tsx` — the same four, against `detail.titleEdit` (existing tests from ~line 246).
4. `apps/web/src/components/reporting/reports-view.spec.tsx` — beside the existing save-form test (~lines 898–906):
   - *"returns focus to the save-current-view trigger after saving"* — open the form, fill the name, click `dashboards.save`, await the mutation, assert focus is on the `dashboards.saveCurrentView` button.
   - *"returns focus to the save-current-view trigger after cancelling"* — open the form, click `dashboards.cancel`, assert the same.
   - *"does not focus the save-current-view trigger on first render"*.

**Unit, `packages/ui`.**

5. **Create file: `packages/ui/src/lib/menu.spec.ts`** — modelled on `packages/ui/src/lib/icons.spec.ts` (a spec beside the module it tests, asserting exported constants). Assert `menuItemClassName` contains `focus-ring-always`; assert it still contains `focus:bg-surface-muted` (the tint is a supplement, not a replacement); assert it matches no raw palette literal (`/slate-\d/`, `/blue-\d/`); assert `menuContentClassName`, `menuLabelClassName` and `menuSeparatorClassName` are byte-unchanged from their current values, so the story's blast radius is pinned to one constant.
6. `packages/ui/src/components/dropdown-menu.spec.tsx` — extend the existing rendered-item assertions (~lines 120–125): the item carries `focus-ring-always` and still carries `text-danger-foreground` when `destructive`.
7. `packages/ui/src/components/select.spec.tsx` — a sibling to `"keeps the trigger's own token styling and shared focus treatment"` (~line 140): an open `SelectItem` carries `focus-ring-always`, mirroring that test's assertion shape including the `not.toMatch(/slate-\d/)` guard.

8. Every existing test in all four suites remains unchanged. No assertion is weakened, skipped or deleted.

---

## Verification Steps

1. **Frontend runs:** `pnpm --filter @crm/web test` — baseline measured at HEAD `042111a`: **85 files, 1228 tests passing**. Expect 1228 + the new cases, 0 failures.
2. **Frontend runs:** `pnpm --filter @crm/ui test` — baseline **29 files, 258 tests passing**. Expect 258 + the new cases.
3. **Regression:** `pnpm --filter @crm/portal test` — baseline **44 files, 366 tests passing**, expected **unchanged at 366**. The portal is not touched; a change here means the `packages/ui` edit leaked.
4. **Regression:** `apps/web/src/design-tokens.spec.ts` and `apps/portal/src/design-tokens.spec.ts` still pass — no raw palette literal, no new surface string.
5. **Backend builds:** `pnpm typecheck`, then `pnpm lint`, then `pnpm build`, from the repository root. The four `ref` attachments are the only new type surface; all four targets are `HTMLButtonElement`.
6. **Regression:** `git diff --stat` shows exactly 8 source files plus 1 new spec — `packages/ui/src/lib/menu.ts`, `packages/ui/src/lib/menu.spec.ts` (new), `packages/ui/src/components/dropdown-menu.spec.tsx`, `packages/ui/src/components/select.spec.tsx`, and the four `apps/web` views with their four specs. **No `.tsx` under `packages/ui/src/components/` other than the two spec files.** No `apps/portal` file, no `apps/api` file, no `packages/config` file.
7. **Regression:** EN/AR message catalogues are byte-identical — `git diff --stat -- apps/web/messages apps/portal/messages` is empty. No key was added.
8. Re-scan: `grep -n "focus:bg-surface-muted" packages/ui/src/` returns the one surviving occurrence in `menu.ts`, now paired with `focus-ring-always`.

---

## Done Criteria

- [ ] Ticket detail inline edit returns focus to the `detail.subjectEdit` trigger after Escape.
- [ ] Ticket detail inline edit returns focus to the `detail.subjectEdit` trigger after Enter/save.
- [ ] Customer detail inline edit returns focus to `detail.displayNameEdit` after Escape and after Enter/save.
- [ ] Knowledge-base article detail inline edit returns focus to `detail.titleEdit` after Escape and after Enter/save.
- [ ] Edit-input `autoFocus`, `onChange`, `onKeyDown` draft-reset and `onBlur` commit/revert are unchanged in all three views.
- [ ] Reports "Save current view" returns focus to its persistent trigger after Save.
- [ ] Reports "Save current view" returns focus to its persistent trigger after Cancel.
- [ ] No restore fires on first render, and none fires when the user leaves an edit by focusing another control — both asserted.
- [ ] `menuItemClassName` carries `.focus-ring-always`; `DropdownMenuItem` and `SelectItem` inherit it with no edit to either component.
- [ ] No colour or surface token added, removed or changed; `packages/config/tailwind-tokens.css` is untouched.
- [ ] No shared focus-management hook or primitive introduced; the four restores are inline, per the `ConfirmDialog` precedent.
- [ ] `menuContentClassName`, `menuLabelClassName`, `menuSeparatorClassName` and `Popover` are unchanged.
- [ ] Tests cover all four focus-restoration paths and the menu/select focus-indicator invariant.
- [ ] web / ui / portal suites, typecheck, lint and build all green; portal count unchanged at 366; no test weakened, skipped or deleted.
- [ ] No backend, RBAC, routing, i18n or portal CSAT change; diff limited to Story 166 scope.
