# Story 187 — Surfaces and overlays

> CRM UI/UX redesign roadmap item **RD-1.10** ("Primitives C: surfaces and overlays"). Intake: [`../../stories/surfaces-and-overlays/surfaces-and-overlays/intake.md`](../../stories/surfaces-and-overlays/surfaces-and-overlays/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §4.2 and §6 "RD-1.10".

---

## Prerequisites

- **Story 179 completed** (`bac28a3`, RD-1.2): radius `rounded-control`/`rounded-surface`/`rounded-inner`/`rounded-pill`, elevation `shadow-resting`/`shadow-raised`/`shadow-overlay`, motion variables and the `fade-*`/`zoom-*` keyframes, `text-heading`/`text-label`, the global `prefers-reduced-motion` rule, and `cn` registration of every named scale. Plan record: [`../crm-ui-ux-redesign/179-story-shape-elevation-motion-type-tokens.md`](../crm-ui-ux-redesign/179-story-shape-elevation-motion-type-tokens.md).
- **Story 181 completed** (`7ca05a1`, RD-1.4): light and dark values for `surface-raised`, `overlay` and every other token used here.
- **Story 185 / Story 186 completed** (`7efabea`, `c1b550e`): Button/Badge/Alert, form controls, and `CheckIcon`/`MinusIcon`/`CloseIcon` routed through `packages/ui/src/lib/icons.ts`. This Story follows the same shape: one shared class string per family, token-only, additive API. Precedent: [`../crm-ui-ux-redesign/186-story-form-control-primitives.md`](../crm-ui-ux-redesign/186-story-form-control-primitives.md).
- **A draft implementation of this Story already sits uncommitted in the working tree** (10 files, listed in task 0). It is **not accepted by default**. Task 0 reconciles it against this plan; every later task states the required end state, whether or not the draft already matches it.
- Shared contract: `packages/ui` is consumed by both `apps/web` and `apps/portal`, and must stay **translation-free** (no `next-intl` import, all copy via props).

---

## Story Goal

Move the shared surface and overlay primitives in `@crm/ui` onto the design language from Stories 178–186, so that every card, dialog, menu, select panel, popover, tooltip, skeleton and empty state reads as one product in light and dark, LTR and RTL. Nothing any screen does may change.

User-visible outcomes:

1. Cards and section cards get the comfortable 20px padding (was 16px).
2. Dialogs and confirmation dialogs sit on a raised surface with a 12px radius, the overlay elevation and a /50 scrim. They open with a subtle fade and slight zoom, stay centred in both directions while animating, and scroll internally when taller than the viewport.
3. `DialogContent` offers `size` = `sm` | `md` | `lg` | `xl`. The default `md` is today's width.
4. Menus, select panels and popovers sit on the raised surface with the raised shadow and animate in. Dropdown menu rows no longer leave a blank check-mark gutter; select rows keep it for their check mark.
5. Tooltips keep their inverted look, with a token radius, the raised shadow and a fade.
6. Skeletons use the nested-item radius. Empty states use the surface radius, comfortable padding, and a tinted disc behind the optional icon.

**Not in scope:** Sheet/drawer (RD-6.1), `SectionCard` `collapsible` (RD-3.3), page-shaped skeleton recipes (RD-3.12), Table/Toast/Avatar/BackLink/DescriptionList (RD-1.11–1.13), `ErrorState` (RD-2.5), moving any screen onto dialogs, folding `apps/web/src/components/confirm-dialog.tsx` into `@crm/ui` (it only supplies translated labels, so it stays), any new dependency, and any backend/API/database/auth/routing change.

---

## Context — Read These Files First

1. `packages/ui/src/lib/overlay.ts` — read whole (45 lines). `overlayClassName` (~line 17–18) is the scrim shared by `Dialog`, `AlertDialog` and `NavigationOverlay`. `overlayPanelClassName` (~line 35–36) is the centred panel: note `start-1/2 … -translate-x-1/2 -translate-y-1/2 … rtl:translate-x-1/2`, which **is the centring**, and `w-[calc(100%-2rem)]` (the 320px gutter). In the draft, `overlayPanelSizeClassName`/`OverlayPanelSize` are at ~lines 38–45. The header comment (~lines 1–13, 15–16) contains statements the draft made false ("values are unchanged…", "used here at 40%").
2. `packages/ui/src/lib/menu.ts` — read whole (46 lines). `menuContentClassName` (~17–18), `menuItemClassName` (~34–35) and its doc comment (~20–33, which still says "`ps-8 pe-2` leaves room… for a check indicator"), `menuCheckableItemClassName` (draft, ~37–42), `menuLabelClassName` (~44), `menuSeparatorClassName` (~46). The file header (~lines 1–8) says "adopting them changes nothing", which is no longer true.
3. `packages/ui/src/components/dialog.tsx` — `DialogContentProps` (~lines 46–62), `DialogContent` (~64–88, close button ~76–84), `DialogTitle` (~94–104). `closeLabel` stays required for the close button to render.
4. `packages/ui/src/components/alert-dialog.tsx` — `AlertDialogContent` (~lines 42–57, applies `overlayPanelClassName` with `role="alertdialog"`), `AlertDialogTitle` (~63–73).
5. `packages/ui/src/components/confirm-dialog.tsx` — ~lines 94–130. It renders `AlertDialogContent` with `onEscapeKeyDown`/`onPointerDownOutside` (blocked while pending) and `onCloseAutoFocus` (manual focus return), then a header and a footer only. **No code change here.**
6. `packages/ui/src/components/select.tsx` — `SelectContent` (~lines 95–125: `menuContentClassName` plus its own `max-h-[var(--radix-select-content-available-height)] p-0` and `translate-y-1`), `SelectItem` (~131–155: draft adds `menuCheckableItemClassName`; the check indicator is at `absolute start-2`, ~line 146).
7. `packages/ui/src/components/dropdown-menu.tsx` — `DropdownMenuContent` (~line 42) and `DropdownMenuItem` (~64) use `menuContentClassName`/`menuItemClassName`; `DropdownMenuLabel` (~74). **No code change here.**
8. `packages/ui/src/components/popover.tsx` — ~line 42 `cn(menuContentClassName, "w-72 p-3", className)`. Inherits the panel change. **No code change here.**
9. `packages/ui/src/components/tooltip.tsx` — `TooltipContent` class string, ~line 44.
10. `packages/ui/src/components/skeleton.tsx` — ~line 11. `packages/ui/src/components/empty-state.tsx` — ~lines 59–90 (container ~62, icon disc ~67–74, the `<p>`-not-heading comment and title/description).
11. `packages/ui/src/components/card.tsx` — `cardVariants` ~line 27 (`rounded-surface border border-rule bg-surface`), `raised: "shadow-resting"` ~31, `p-surface` at ~66, ~129, ~191. **No code change here;** padding comes from the token.
12. `packages/ui/src/components/query-state-card.tsx` — ~line 173 renders `EmptyState`; ~215 `text-xs opacity-80` (see Edge Cases). **No code change here.**
13. `packages/ui/src/components/navigation-overlay.tsx` — ~lines 1–3 and ~45: reuses `overlayClassName` on a plain `<div>` with no `data-state`.
14. `packages/config/tailwind-preset.js` — `keyframes`/`animation` ~lines 230–254. The draft's `zoom-in`/`zoom-out` (~246–247) animate the individual `scale` property.
15. `packages/config/tailwind-tokens.css` — `--space-surface` ~line 273 (draft `1.25rem`), its historical note ~line 256; `.focus-ring`/`.focus-ring-always` ~lines 542–552 (both use `ring-offset-surface`).
16. Specs to update or extend: `packages/ui/src/lib/menu.spec.ts` (~lines 33–37 pin `ps-8`/`pe-2`; ~51 pins the old label string); `packages/ui/src/components/skeleton.spec.tsx` (~line 21 pins `rounded-md`); `packages/ui/src/components/card.spec.tsx` (~lines 52–54, a comment stating `--space-surface is 1rem`); `dialog.spec.tsx` (~122–132 gutter test); `dropdown-menu.spec.tsx` (~123–149); `select.spec.tsx` (~98–105, ~144–160); `empty-state.spec.tsx` (~26–31); `tooltip.spec.tsx` (~71–72); `confirm-dialog.spec.tsx` (must pass unchanged).
17. Guards that must stay green: `apps/web/src/test/style-guard.spec.ts`, `apps/web/src/test/token-contrast.spec.ts`, `apps/web/src/design-tokens.spec.ts`, `apps/portal/src/design-tokens.spec.ts`.
- Grep for `<ConfirmDialog` in `apps/web/src` (23 production call sites, e.g. `apps/web/src/components/dashboard/tasks-panel.tsx` ~line 163 and `apps/web/src/components/tickets/ticket-detail-view.tsx` ~line 742) to choose a dialog to open during visual verification.

---

## Product rules (from story)

| Element | Before this Story | After this Story |
|---|---|---|
| Card / SectionCard padding | `p-surface` = 1rem | `p-surface` = 1.25rem (token value only) |
| Dialog scrim | `bg-overlay/40`, no motion | `bg-overlay/50`, fade on open/close |
| Dialog panel | `rounded-md bg-surface shadow-lg`, `max-w-md` only, no max-height | `rounded-surface bg-surface-raised shadow-overlay`, `size` sm/md/lg/xl (md default), `max-h-[calc(100dvh-2rem)] overflow-y-auto`, fade + zoom |
| Dialog / AlertDialog title | `text-base font-semibold` | `text-heading` |
| Menu / select / popover panel | `rounded-md bg-surface shadow-md` | `rounded-control bg-surface-raised shadow-raised`, fade + zoom |
| Dropdown menu item | `rounded-sm ps-8 pe-2` | `rounded-inner px-2` (no check gutter) |
| Select item | `ps-8 pe-2` (via shared item) | shared item **plus** `ps-8` (check gutter kept) |
| Menu label | `text-xs font-semibold` | `text-label` |
| Tooltip | `rounded-md shadow-md` | `rounded-inner shadow-raised`, fade |
| Skeleton | `rounded-md` | `rounded-inner` |
| EmptyState | `rounded-md p-8`, bare icon | `rounded-surface px-6 py-10`, icon in a `surface-muted` disc |

---

## Frontend Tasks

No backend changes required. No file under `apps/web` or `apps/portal` changes except the specs named in the Test Plan, and only where an intentional token change requires it.

### 0 — Reconcile the existing draft before anything else

1. Run `git diff --stat` and `git diff` from the repo root. Confirm the draft touches exactly: `packages/config/tailwind-preset.js`, `packages/config/tailwind-tokens.css`, `packages/ui/src/components/{alert-dialog,dialog,empty-state,select,skeleton,tooltip}.tsx`, `packages/ui/src/lib/{menu,overlay}.ts`. **Do not** stash, reset or check out these files.
2. Go through tasks 1–10 below. For each, compare the draft with the stated end state and **keep, change, or revert** accordingly. The intended differences are summarised here:
   - Keep the draft as-is: preset keyframes (1), the spacing token (2), the menu class values (3), the dialog component (5), alert-dialog (6), select (7), skeleton (9), empty-state (10).
   - **Change** overlay.ts: remove `flex` and `flex-col` from the panel (4).
   - **Change** tooltip.tsx: also animate the `instant-open` state (8).
   - **Change** doc comments made stale in menu.ts and overlay.ts (3, 4).
3. Anything in the draft not described in tasks 1–10 is **reverted**.

### 1 — Zoom motion must not move the centred panel

**File: `packages/config/tailwind-preset.js`** (~lines 240–254)

End state: `zoom-in`/`zoom-out` animate **opacity and the individual `scale` property only**, never `transform`. Keep the draft's explanatory comment.

```js
    // Story 187 — the individual `scale` property, NOT `transform`: a centred
    // dialog positions itself with translate(-50%, -50%), and a transform
    // keyframe would overwrite that for the duration of the animation.
    "zoom-in": { from: { opacity: "0", scale: "0.96" }, to: { opacity: "1", scale: "1" } },
    "zoom-out": { from: { opacity: "1", scale: "1" }, to: { opacity: "0", scale: "0.96" } },
```

**Do not** change the `animation` entries (~249–254) or the `fade-*` keyframes.

### 2 — Comfortable card padding via the token

**File: `packages/config/tailwind-tokens.css`** (~line 273)

End state:

```css
    --space-surface: 1.25rem; /* Story 187 — comfortable card padding (was 1rem) */
```

This is the roadmap's §2.10 density value (20px). It reaches every `*-surface` spacing utility (about 35 uses: Card/SectionCard via `card.tsx` ~66/~129/~191, plus a few page-level `px-surface`), and is intentional. **Do not** add per-component padding overrides. Leave the historical measurement table above it (~line 256) unchanged; it records the 2026 measurement that named the token.

### 3 — Menu surfaces and the check-mark gutter

**File: `packages/ui/src/lib/menu.ts`**

End state for the constants:

```ts
export const menuContentClassName =
  "z-50 max-h-[var(--radix-popper-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-control border border-rule bg-surface-raised p-1 text-ink shadow-raised data-[state=open]:animate-zoom-in data-[state=closed]:animate-zoom-out";

export const menuItemClassName =
  "focus-ring-always relative flex w-full cursor-pointer select-none items-center gap-2 rounded-inner px-2 py-1.5 text-sm outline-none transition-colors duration-fast focus:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export const menuCheckableItemClassName = "ps-8";

export const menuLabelClassName = "px-2 py-1.5 text-label text-ink-subtle";

export const menuSeparatorClassName = "-mx-1 my-1 h-px bg-rule"; // unchanged
```

Rewrite two stale comments:
- **File header (~lines 1–8):** replace "Values match `Select`'s existing content styling … changes nothing" with a Story 187 note: the panel is the raised floating surface (`surface-raised`, `shadow-raised`, `rounded-control`, fade+zoom), shared by DropdownMenu, Select and Popover.
- **`menuItemClassName` doc (~lines 20–21):** replace "`ps-8 pe-2` leaves room at the reading-start edge for a check indicator…" with "`px-2` on both edges; an item that can show a check mark adds `menuCheckableItemClassName`". **Keep** the Story 166 focus paragraph (~22–33) verbatim; its "4px outside the item's box… `p-1`" reasoning still holds.

### 4 — One shared overlay treatment, sizes, no layout change

**File: `packages/ui/src/lib/overlay.ts`**

End state:

```ts
export const overlayClassName =
  "fixed inset-0 z-50 bg-overlay/50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";

export const overlayPanelClassName =
  "fixed start-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-surface border border-rule bg-surface-raised p-6 text-ink shadow-overlay focus:outline-none rtl:translate-x-1/2 data-[state=open]:animate-zoom-in data-[state=closed]:animate-zoom-out";

/** Story 187 (RD-1.10) — dialog widths, applied after the panel class (`cn` lets the later `max-w-*` win). */
export const overlayPanelSizeClassName = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
} as const;
export type OverlayPanelSize = keyof typeof overlayPanelSizeClassName;
```

**Remove `flex` and `flex-col`** from the draft's panel string. They add no value, since block layout already scrolls with `overflow-y-auto`, and they would turn every panel child into a flex item: margins stop collapsing and children could shrink. That is a layout change for the 23 `ConfirmDialog` call sites, which this Story must not make.

Keep `max-w-md` in the base string, because `AlertDialogContent` passes no size and must stay at today's width.

Rewrite the stale comments:
- **Header (~lines 11–12):** "values are unchanged … renders identically" becomes a Story 187 note: raised panel, overlay elevation, viewport-bounded scrolling, fade+zoom motion, and widths in `overlayPanelSizeClassName`.
- **Scrim doc (~15–16):** "used here at 40%" becomes "at 50%, fading in and out".

Keep the RTL centring paragraph and the Batch 8 gutter paragraph (~20–34) verbatim.

### 5 — Dialog: sizes, title scale, close button

**File: `packages/ui/src/components/dialog.tsx`**

End state (matches the draft; verify each point):
- `import { CloseIcon as X } from "../lib/icons";` replaces the direct `lucide-react` import.
- `import { overlayClassName, overlayPanelClassName, overlayPanelSizeClassName } from "../lib/overlay";` plus `import type { OverlayPanelSize } from "../lib/overlay";`.
- `DialogContentProps` gains **optional** `size?: OverlayPanelSize;` with the doc comment `/** Story 187 (RD-1.10) — panel width: sm 24rem, md 28rem (default), lg 32rem, xl 42rem. */`.
- `DialogContent` destructures `size = "md"` and applies `cn(overlayPanelClassName, overlayPanelSizeClassName[size], className)`.
- Close button `className="focus-ring absolute end-4 top-4 rounded-inner p-1 text-ink-subtle transition-colors duration-fast hover:bg-surface-muted hover:text-ink"`. Keep `aria-label={closeLabel}`, the "`end-4`, not `right-4`" comment, the `showClose && closeLabel` condition and `<X className="h-4 w-4" aria-hidden />`.
- `DialogTitle` uses `cn("text-heading text-ink", className)`.

**Do not** change `DialogHeader`, `DialogDescription` or `DialogFooter`.

### 6 — AlertDialog title on the scale

**File: `packages/ui/src/components/alert-dialog.tsx`** (~line 70): `AlertDialogTitle` uses `cn("text-heading text-ink", className)`. No other change. `AlertDialogContent` keeps `role="alertdialog"` and takes no `size` prop, since the API stays additive only where it's needed.

### 7 — Select keeps its check gutter

**File: `packages/ui/src/components/select.tsx`**

End state: the import includes `menuCheckableItemClassName`, and `SelectItem` uses:

```tsx
    className={cn(
      menuItemClassName,
      menuCheckableItemClassName,
      "data-[state=checked]:font-medium",
      className,
    )}
```

The indicator comment (~line 145) names `menuCheckableItemClassName`'s `ps-8`. **Do not** touch `SelectTrigger`, the `SelectContent` max-height/`translate-y-1` override, or the indicator `absolute start-2`.

### 8 — Tooltip

**File: `packages/ui/src/components/tooltip.tsx`** (~line 44)

End state:

```tsx
        "z-50 max-w-xs rounded-inner bg-ink px-2.5 py-1.5 text-xs text-surface shadow-raised data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in data-[state=closed]:animate-fade-out",
```

Radix Tooltip's open states are `delayed-open` **and** `instant-open`; the draft animates only the first. Keep the inverted `bg-ink text-surface` and the existing comment above it.

### 9 — Skeleton radius

**File: `packages/ui/src/components/skeleton.tsx`** (~line 11): `cn("animate-pulse rounded-inner bg-rule", className)`. The pulse stops under reduced motion through the global rule in `tailwind-tokens.css` (Story 179); **do not** add a component-level override.

### 10 — EmptyState surface and icon disc

**File: `packages/ui/src/components/empty-state.tsx`** (~lines 59–90)

End state:
- Container: `"flex flex-col items-center gap-2 rounded-surface border border-dashed border-rule-strong px-6 py-10 text-center"`.
- Icon wrapper, still `aria-hidden="true"`, still rendered only when `icon` is set: `className="mb-1 flex h-10 w-10 items-center justify-center rounded-pill bg-surface-muted text-ink-muted"`, with the draft's Story 187 comment above it.
- Title/description `<p>` elements, the `<p>`-not-heading comment and the `action` slot are **unchanged**.

### 11 — Components that inherit and must not change

`card.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `confirm-dialog.tsx`, `query-state-card.tsx`, `navigation-overlay.tsx`: **no source edits**. They pick the redesign up through `menu.ts`, `overlay.ts`, `empty-state.tsx` and the `--space-surface` token. The Test Plan confirms each by spec.

---

## Edge Cases & Failure Modes

- **Animation moving a centred panel.** If any keyframe animated `transform`, the dialog would render off-centre (or jump) during open/close, in RTL especially, where `rtl:translate-x-1/2` flips the sign. Enforced in `packages/config/tailwind-preset.js` (~246–247) by animating `scale`; guarded by a new spec (Test Plan 9). Browsers without the individual `scale` property simply skip the zoom; opacity still animates and centring is unaffected.
- **`cn` and dialog widths.** `overlayPanelClassName` contains `max-w-md`, and the size class is appended afterwards. tailwind-merge keeps the last `max-w-*`, so `size="xl"` yields only `max-w-2xl`. Covered by Test Plan 4.
- **A caller's own `max-w-*` on DialogContent/AlertDialogContent.** `className` is merged last and still wins, as today. There are 0 production DialogContent call sites, and ConfirmDialog passes no className (`confirm-dialog.tsx` ~96–107).
- **Tall content at 320px or in a short landscape viewport.** The panel caps at `100dvh - 2rem` and scrolls inside. The absolutely positioned close button (`dialog.tsx` close button) scrolls with the content: acceptable, and Escape still closes. `dvh` is unsupported only in very old browsers, where the `max-h` utility is ignored and behaviour is today's.
- **No `flex-col` on the panel.** Header and footer keep block flow with their own margins (`DialogFooter`/`AlertDialogFooter` `mt-4`), exactly as today. Verify a ConfirmDialog visually.
- **NavigationOverlay shares the scrim.** `navigation-overlay.tsx` (~45) gets `bg-overlay/50`, slightly darker than before. It has no `data-state`, so the new fade utilities never fire there. This is intentional; one scrim value is the design language.
- **Focus ring on raised surfaces.** `.focus-ring`/`.focus-ring-always` use `ring-offset-surface` (`tailwind-tokens.css` ~542–552). On `surface-raised` in dark mode the 2px offset paints `#0F172A` on `#1E293B`, a visible dark gap between item and ring. This is acceptable and required: an independent QA watch item says the offset must stay, so the indigo ring never touches an indigo fill. **Do not** change the focus utilities.
- **Dropdown items without a check gutter.** `DropdownMenuItem` in `dropdown-menu.tsx` (~64) renders no indicator, so removing `ps-8` only removes blank space. Any future checkbox/radio menu item must opt in with `menuCheckableItemClassName`.
- **Select inside a dialog.** Both are portalled; the select panel is `z-50` like the dialog panel and is rendered later, so it stacks above. Unchanged by this Story.
- **Reduced motion.** The global rule in `tailwind-tokens.css` (Story 179) shortens every animation to ~0.01ms, so dialogs, menus and tooltips appear without motion and the skeleton pulse stops. No component-level handling.
- **Dark mode.** `surface-raised` (dark `#1E293B`), `overlay` (dark `#000000`), `ink`/`surface` (tooltip inversion: light tooltip on dark UI) and `surface-muted` (empty-state disc) all have dark values, guarded by `apps/web/src/test/token-contrast.spec.ts`. No `dark:` variant may be added (style guard).
- **Padding growth.** At 1.25rem, card content loses 8px of width; at 320px a SectionCard content box shrinks from 270px to 262px. The screenshot matrix must show no new horizontal overflow, especially on the dashboard and ticket detail.
- **`query-state-card.tsx` ~215 `text-xs opacity-80`.** This dims an alert's description. It predates this Story and is not a `text-*-foreground/NN` pattern, so the style guard doesn't flag it. **Out of scope here; do not change it.** Note it in the completion report for the RD-7.7 accessibility pass.

---

## Test Plan

Unit/component tests (Vitest + Testing Library, in `packages/ui/src/**` unless noted). Match the existing style of each file.

1. **Modify** `packages/ui/src/lib/menu.spec.ts`:
   - Replace the "keeps its reading-direction-relative geometry" test (~33–37) with: `menuItemClassName` contains `px-2` and `rounded-inner`, does **not** contain `ps-8`, and has no `pl-`/`pr-`.
   - Add a test that `menuCheckableItemClassName` is exactly `"ps-8"`.
   - Change the label assertion (~51) to `"px-2 py-1.5 text-label text-ink-subtle"`. Keep the separator assertion unchanged.
   - Add: `menuContentClassName` contains `bg-surface-raised`, `shadow-raised`, `rounded-control`, `data-[state=open]:animate-zoom-in`, and still `p-1`.
2. **Create** `packages/ui/src/lib/overlay.spec.ts`:
   - `overlayClassName` contains `bg-overlay/50` and the fade animations.
   - `overlayPanelClassName` contains `bg-surface-raised`, `rounded-surface`, `shadow-overlay`, `border-rule`, `max-h-[calc(100dvh-2rem)]`, `overflow-y-auto`, `w-[calc(100%-2rem)]`, `rtl:translate-x-1/2`, and does **not** contain the tokens `flex` or `flex-col` (split on spaces).
   - `overlayPanelSizeClassName` maps sm/md/lg/xl to four distinct `max-w-*` values, with md = `max-w-md`.
3. **Extend** `packages/ui/src/components/dialog.spec.tsx`: the panel defaults to `max-w-md`; `size="sm"` yields `max-w-sm` and not `max-w-md`; `size="xl"` yields `max-w-2xl`; the panel has `bg-surface-raised`; `DialogTitle` has `text-heading`; the close button keeps its accessible name, has `rounded-inner`, and its svg is `aria-hidden`. Keep the gutter test (~122–132).
4. **Extend** `packages/ui/src/components/confirm-dialog.spec.tsx` with one test that the title has `text-heading` and the `alertdialog` panel has `bg-surface-raised`. **All existing tests must pass unmodified**: pending blocks Escape/outside, focus returns, labels come from props.
5. **Extend** `packages/ui/src/components/dropdown-menu.spec.tsx`: an open menu's item does **not** have `ps-8`; the content has `bg-surface-raised`.
6. **Extend** `packages/ui/src/components/select.spec.tsx`: an open select's option **has** `ps-8`; the content has `bg-surface-raised` and keeps `overflow-y-auto` (~98).
7. **Modify** `packages/ui/src/components/skeleton.spec.tsx` (~21): `rounded-md` becomes `rounded-inner` (the radius token changed; the intent, a token-defined radius, is preserved).
8. **Extend** `packages/ui/src/components/empty-state.spec.tsx` (next to ~26–31): the icon wrapper has `rounded-pill` and `bg-surface-muted` and is still `aria-hidden`; the container has `rounded-surface`.
9. **Extend** `packages/ui/src/components/tooltip.spec.tsx` (next to ~71–72): the content has `rounded-inner`, `shadow-raised`, and both open-state fade classes.
10. **Modify comment only** in `packages/ui/src/components/card.spec.tsx` (~52–54): say `--space-surface` is now 1.25rem (Story 187). Assertions are unchanged; they check class names, not values.
11. **Extend** `apps/web/src/test/token-contrast.spec.ts` (it already reads `packages/config` files): import `@crm/config/tailwind-preset` and assert that `keyframes["zoom-in"]` and `keyframes["zoom-out"]` contain no `transform` key and do contain `scale`. Also assert `--space-surface` in the light `:root` block is `1.25rem`, by reading the CSS text the same way the file already reads tokens.
12. **Unchanged, must stay green:** `packages/ui/src/components/{popover,card,query-state-card,navigation-overlay}.spec.tsx`, `apps/web/src/test/style-guard.spec.ts`, `apps/{web,portal}/src/design-tokens.spec.ts`, and every `apps/web` / `apps/portal` spec. If an app spec fails because it pins a class this Story intentionally changed, update that assertion to the new token, keep its intent, and list it in the completion report. Otherwise fix the implementation, not the test.

Smoke/visual tests are manual (see Verification Steps); there is no visual-regression infrastructure.

---

## Verification Steps

1. **Scope check (repo root):** `git status --short` and `git diff --stat`. Only the files in tasks 1–10 plus the specs in the Test Plan, this plan, the intake and the overviews may differ. `qa-review.md` stays untracked and untouched; `stash@{0}` stays untouched.
2. **Unit tests:** run `pnpm --filter @crm/ui test`, then `pnpm --filter @crm/web test`, then `pnpm --filter @crm/portal test`. Run them sequentially; parallel runs on this machine have caused timeouts. All must pass.
3. **Static:** `pnpm --filter @crm/ui typecheck`, `pnpm --filter @crm/web typecheck`, `pnpm --filter @crm/portal typecheck`, `pnpm --filter @crm/ui lint`, `pnpm --filter @crm/web lint`, `pnpm --filter @crm/portal lint`.
4. **Builds:** `pnpm --filter @crm/web build`, then `pnpm --filter @crm/portal build` (about 17 minutes each here). Stop any server using `apps/*/.next` first. If the environment prevents a build, record the exact error and why as a documented blocker; do not skip silently.
5. **Frontend runs (visual):**
   - Clear `apps/web/.next/cache/webpack` and `apps/portal/.next/cache/webpack`, start the API (`pnpm --filter @crm/api start`) and the app servers, and capture 320 / 768 / 1280 × en / ar × light / dark of: web dashboard, web ticket detail, web tickets list, portal home, portal tickets.
   - **Open each overlay** and inspect it while open:
     - a ConfirmDialog (dashboard task delete in `tasks-panel.tsx` ~163, or the SLA hold in `ticket-detail-view.tsx` ~742);
     - a Select (ticket list status filter);
     - a DropdownMenu (the mobile navigation menu at 320px, or a navbar group menu);
     - the sidebar tooltip, with the rail collapsed.
   - Confirm in each case:
     - the dialog is centred in LTR and RTL, during and after opening;
     - it scrolls inside a 320×500 viewport;
     - select rows show the check-mark gutter and dropdown rows don't;
     - no new horizontal overflow;
     - focus rings are visible on menu items in both themes.
6. **Regression:** `git diff --check` reports nothing. Review the complete diff for anything outside this plan, revert it, and confirm no `dark:` variant, raw palette class, hex value or new arbitrary radius/shadow was added (the style guard enforces most of this).

---

## Done Criteria

- [ ] Draft reconciled: every hunk matches tasks 1–10; `flex`/`flex-col` removed from the panel; tooltip animates `instant-open`; the stale comments in `menu.ts` and `overlay.ts` are rewritten; nothing else from the draft remains.
- [ ] Card, SectionCard, Dialog, AlertDialog/ConfirmDialog, DropdownMenu, Select content, Popover, Tooltip, Skeleton and EmptyState take colour, radius, elevation, spacing, type and motion from tokens only; style guard and token-contrast specs are green.
- [ ] Dialog and AlertDialog share one panel (surface-raised, rounded-surface, shadow-overlay, rule border, viewport-bounded scroll) and one scrim (overlay /50, fade).
- [ ] `DialogContent` `size` accepts sm/md/lg/xl; omitting it gives `max-w-md`; each size maps to a distinct width.
- [ ] Dialog and AlertDialog titles use `text-heading`.
- [ ] The close button keeps `closeLabel` as its accessible name, uses `CloseIcon` from `lib/icons.ts`, and sits at `end-4`.
- [ ] Zoom keyframes animate `scale`, never `transform`; dialogs stay centred in LTR and RTL while animating (spec plus visual check).
- [ ] ConfirmDialog's existing specs pass unmodified; behaviour (pending blocks dismiss, focus return, label props) is unchanged; the web wrapper is untouched.
- [ ] Menu/select/popover panels use surface-raised, shadow-raised, rounded-control and fade+zoom; menu labels use `text-label`.
- [ ] DropdownMenu items have no `ps-8`; SelectItem has `ps-8` and its indicator still sits at `start-2`.
- [ ] Tooltip keeps `bg-ink text-surface`, uses `rounded-inner` and `shadow-raised`, and fades on both open states and on close.
- [ ] Skeleton uses `rounded-inner`; the pulse stops under reduced motion (global rule).
- [ ] EmptyState uses `rounded-surface` and `px-6 py-10`; its icon sits in an aria-hidden `surface-muted` disc; text and action rendering are unchanged.
- [ ] `--space-surface` is 1.25rem and no component adds its own padding override.
- [ ] The only API addition is the optional `size` on `DialogContent` (plus the exported class constants); no consumer in `apps/web`/`apps/portal` changes; `@crm/ui` gains no i18n dependency.
- [ ] EN/AR, RTL/LTR, light/dark, 320/768/1280 checked with overlays open; no new overflow; focus visible.
- [ ] ui, web and portal tests pass; typecheck and lint pass for all three; both production builds succeed, or a blocker is documented.
- [ ] No backend, API, database, auth, routing or business-rule change.
