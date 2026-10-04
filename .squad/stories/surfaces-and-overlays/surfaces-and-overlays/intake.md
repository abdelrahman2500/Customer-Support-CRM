> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/surfaces-and-overlays/surfaces-and-overlays/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Surfaces and overlays
- **Feature slug (folder under `plans/`):** `surfaces-and-overlays`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — created with `--no-tracker`; this is redesign roadmap item **RD-1.10**, global Story **187**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning` (an uncommitted draft implementation exists — see Extra notes)
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-1-design-foundation`, `packages/ui`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Surfaces and overlays
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Story 187 — RD-1.10 "Primitives C: surfaces and overlays" of the CRM UI/UX
redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md,
§4.2 and §6 "RD-1.10"; audit: .squad/plans/crm-ui-ux-redesign/recon.md §2.3;
progress: .squad/plans/crm-ui-ux-redesign/progress.md).

GOAL
Move the shared surface and overlay primitives in @crm/ui onto the design
language that Stories 178–186 (RD-1.1–RD-1.9) established, so every card,
dialog, menu, popover, tooltip, skeleton and empty state across apps/web and
apps/portal reads as one product, in light and dark, LTR and RTL — without
changing what any screen does.

CONTEXT (what already exists — do not re-build)
- Tokens (packages/config/tailwind-tokens.css + tailwind-preset.js):
  surfaces `surface` / `surface-sunk` / `surface-muted` / `surface-raised`;
  ink, rule, accent, focus and semantic families with light AND dark values;
  radius `rounded-control` 8px / `rounded-surface` 12px / `rounded-inner` 6px /
  `rounded-pill`; elevation `shadow-resting` / `shadow-raised` /
  `shadow-overlay`; spacing `p-surface`, `section`, `page-x/y`; type scale incl.
  `text-heading` (18px) and `text-label`; motion variables
  (`duration-fast/base/slow`, `ease-standard`) and `fade-in/out`,
  `zoom-in/out` keyframes; a global prefers-reduced-motion rule; tailwind-merge
  registration of every named scale in packages/ui/src/lib/cn.ts.
- Card and SectionCard already use `rounded-surface`, `shadow-resting` and
  `p-surface` (RD-1.2 changed the token values, not the components).
- Shared class strings: packages/ui/src/lib/menu.ts (menu panel, item, label,
  separator — used by DropdownMenu, Select, Popover) and
  packages/ui/src/lib/overlay.ts (backdrop + centred panel — used by Dialog and
  AlertDialog/ConfirmDialog).
- Today (before this Story): menus/popovers are `rounded-md bg-surface
  shadow-md`; every menu item reserves a `ps-8` check-mark gutter even in
  DropdownMenu where no check mark can appear (recon §2.3); the dialog panel is
  `rounded-md bg-surface shadow-lg`, one width (`max-w-md`), no motion, no
  max-height; dialog titles are `text-base font-semibold` (off the type
  scale); the dialog close button and Dialog/Select/Checkbox glyphs partly
  bypass packages/ui/src/lib/icons.ts; Skeleton is `rounded-md`; Tooltip is
  `rounded-md shadow-md`; EmptyState is `rounded-md … p-8` with a bare icon.
- Consumers (production .tsx, apps/web + apps/portal): ConfirmDialog 23,
  DialogContent 0, AlertDialogContent 0 (only via ConfirmDialog),
  SelectContent 34, DropdownMenuContent 3, TooltipContent 1, PopoverContent 0,
  EmptyState 11, QueryStateCard 9, Skeleton ~100, Card 28, SectionCard 40;
  ~35 uses of the `*-surface` spacing token.
- apps/web/src/components/confirm-dialog.tsx wraps the @crm/ui ConfirmDialog
  only to inject translated default labels ("cancel", "working"). @crm/ui is
  deliberately translation-free, so this wrapper is legitimate and stays
  (the roadmap's "fold or justify" is answered: justify).

REQUIRED OUTCOME
1. Surfaces
   - Card / SectionCard keep their token-based radius and elevation and gain the
     comfortable card padding of the design language (roadmap §2.10: 20–24px
     instead of 16px) via the spacing token, not per-component values.
2. Overlays (Dialog, AlertDialog, ConfirmDialog)
   - One shared treatment from lib/overlay.ts: backdrop `bg-overlay` at /50
     with fade; panel on `surface-raised`, `rounded-surface`, `shadow-overlay`,
     `border-rule`; max height bounded to the viewport with internal scrolling;
     subtle open/close motion (fade + slight zoom).
   - Additive, backward-compatible `size` on DialogContent: sm, md (default,
     = today's width), lg, xl. Existing callers keep today's width by default.
   - Dialog and AlertDialog titles on the named type scale (`text-heading`).
   - Close button on token radius with a hover surface and the icon from
     lib/icons.ts; still `end-4` (mirrors in RTL); still requires `closeLabel`.
   - Centring must NOT be broken by animation: the panel is centred with
     translate(-50%, -50%) (plus `rtl:translate-x-1/2`), so open/close motion
     must not animate the `transform` property (e.g. use the individual
     `scale` property or opacity only).
3. Menus, popovers, tooltips
   - Menu/popover panels on `surface-raised`, `shadow-raised`, token radius,
     subtle open/close motion; menu items on `rounded-inner`; menu labels on
     the `text-label` style.
   - Ordinary DropdownMenu items no longer reserve the `ps-8` check-mark
     gutter. Select items KEEP it (their check indicator sits at `start-2`)
     — e.g. via a separate "checkable item" class applied only by SelectItem.
   - Tooltip keeps its inverted ink/surface treatment, moves to token radius
     and `shadow-raised`, with a subtle fade.
4. Skeleton and empty states
   - Skeleton on the nested-item radius (`rounded-inner`); its pulse already
     stops under prefers-reduced-motion (global rule from RD-1.2) — keep it so.
   - EmptyState on `rounded-surface` with comfortable padding and its optional
     icon in a quiet tinted disc (`surface-muted`); text unchanged.
   - QueryStateCard composes EmptyState/Alert/LoadingStatus and should inherit
     the refresh without its own API change.
5. Constraints that hold throughout
   - Only design tokens: no raw palette colours, no new arbitrary radii,
     shadows or hex values (the existing style guard
     apps/web/src/test/style-guard.spec.ts must stay green).
   - @crm/ui stays translation-free; no i18n dependency added.
   - Every change is presentational or an additive, backward-compatible prop.
     No consumer in apps/web or apps/portal needs to change.
   - No change to business logic, routing, auth/authz, API or database
     contracts, or backend behaviour.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
Tokens
- [ ] Card, SectionCard, Dialog, AlertDialog/ConfirmDialog, DropdownMenu,
      Select content, Popover, Tooltip, Skeleton and EmptyState take colour,
      radius, elevation, spacing, type and motion only from the design tokens
      (no raw palette class, hex, arbitrary radius/shadow, or `text-base`
      title); the style guard and token-contrast specs stay green.

Dialogs
- [ ] Dialog and AlertDialog share one panel treatment (surface-raised,
      rounded-surface, shadow-overlay, rule border, viewport-bounded max height
      with internal scroll) and one backdrop treatment (overlay at /50).
- [ ] DialogContent accepts `size` = sm | md | lg | xl; omitting it renders
      exactly today's width (md); each size maps to a distinct max width.
- [ ] Dialog and AlertDialog titles use `text-heading`.
- [ ] The close button keeps its required accessible name (`closeLabel`),
      uses the icon from lib/icons.ts, and sits at the reading-end corner in
      both LTR and RTL.
- [ ] Open/close motion never animates `transform`, so the panel stays
      centred in LTR and RTL during and after the animation.
- [ ] ConfirmDialog's existing behaviour is unchanged: pending state blocks
      Escape/overlay dismiss, focus returns to the trigger, labels still come
      from props (the web wrapper still supplies translations). Its existing
      specs pass unmodified in intent.

Menus / popovers / tooltips
- [ ] DropdownMenu, Select content and Popover panels use surface-raised,
      shadow-raised and token radius, with subtle open/close motion.
- [ ] A DropdownMenu item no longer carries the `ps-8` check gutter; a
      SelectItem still does, and its check indicator still sits at the
      reading-start edge (mirrors in RTL).
- [ ] Tooltip keeps ink-on-surface inversion, uses token radius and
      shadow-raised, and fades.

Skeleton / empty state
- [ ] Skeleton uses `rounded-inner` and its pulse stops under
      prefers-reduced-motion.
- [ ] EmptyState uses `rounded-surface`, comfortable padding, and renders its
      optional icon inside an aria-hidden tinted disc; title/description/action
      rendering and the `<p>`-not-heading rule are unchanged.

Compatibility
- [ ] No component's existing props change meaning; the only API addition is
      DialogContent `size` (plus any new exported class constants). No file
      in apps/web or apps/portal needs editing for this Story to work; any
      spec edited in those apps is justified by an intentional token change
      and keeps its original intent.
- [ ] @crm/ui gains no i18n dependency.

Parity and quality
- [ ] EN and AR render correctly; RTL dialogs centre and mirror (close button,
      Select check indicator, menu gutters use logical properties only).
- [ ] Light and dark themes both render correctly (raised surfaces, overlay
      backdrop, tooltip inversion, empty-state disc), with no off-token colour.
- [ ] Responsive: dialogs fit and scroll inside a 320px-wide viewport; no new
      horizontal overflow at 320 / 768 / 1280.
- [ ] Accessibility: focus trap and focus return (Radix) unchanged, focus
      rings visible on raised surfaces in both themes, reduced motion respected.
- [ ] Relevant @crm/ui specs are updated/added (dialog sizes, title scale,
      checkable vs ordinary menu items, empty-state disc, skeleton radius,
      overlay classes) and pass; affected web/portal suites pass.
- [ ] `pnpm --filter @crm/ui|@crm/web|@crm/portal typecheck` and `lint` pass;
      the production builds of @crm/web and @crm/portal succeed (or, if the
      environment prevents it, the blocker is documented).
- [ ] No backend, API, database, auth or routing change is introduced.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none (no tracker). Roadmap: RD-1.10 depends on RD-1.2.
- **Depends on code areas or other stories:**
  - Completed and pushed: Story 179 / RD-1.2 (radius, elevation, motion, type and spacing tokens; `cn` registration), Story 181 / RD-1.4 (dark tokens, `surface-raised` dark value), Story 185 / RD-1.8 (Button/Badge/Alert), Story 186 / RD-1.9 (form controls; `CheckIcon`/`MinusIcon` in lib/icons.ts; Select trigger).
  - Downstream consumers of this Story: RD-2.5 (ErrorState), RD-3.3 (inspector — SectionCard `collapsible` is **not** part of this Story), RD-4.5 and RD-6.x (dialog sizes), RD-6.1 (Sheet).

## Extra notes (optional)

- **An uncommitted draft implementation already exists and is NOT automatically accepted.** It was written during an interrupted earlier attempt, before this Story existed. The Plan must treat it as input to reconcile, not as done work: every hunk is to be kept, changed or reverted according to the Plan, and the result independently verified before commit. No tests, typecheck, lint, build or screenshots have been run against it.
- Draft files (exactly these 10, unstaged in the working tree):
  - `packages/config/tailwind-preset.js` — zoom keyframes switched from `transform: scale(..)` to the individual `scale` property (centring fix).
  - `packages/config/tailwind-tokens.css` — `--space-surface` 1rem → 1.25rem (comfortable card padding; affects every `*-surface` spacing use).
  - `packages/ui/src/lib/menu.ts` — raised panel, `rounded-control`, motion; items `rounded-inner` without `ps-8`; new `menuCheckableItemClassName = "ps-8"`; label on `text-label`.
  - `packages/ui/src/lib/overlay.ts` — backdrop /50 + fade; panel surface-raised, `rounded-surface`, `shadow-overlay`, `flex flex-col`, `max-h-[calc(100dvh-2rem)] overflow-y-auto`, zoom motion; new `overlayPanelSizeClassName` (sm/md/lg/xl).
  - `packages/ui/src/components/dialog.tsx` — `size` prop, `text-heading` title, close button restyle, icon from lib/icons.ts.
  - `packages/ui/src/components/alert-dialog.tsx` — `text-heading` title.
  - `packages/ui/src/components/select.tsx` — SelectItem adds `menuCheckableItemClassName`.
  - `packages/ui/src/components/skeleton.tsx` — `rounded-inner`.
  - `packages/ui/src/components/tooltip.tsx` — `rounded-inner`, `shadow-raised`, fade.
  - `packages/ui/src/components/empty-state.tsx` — `rounded-surface`, `px-6 py-10`, tinted icon disc.
- Points the Plan must decide explicitly (not settled by the draft):
  - Whether the `--space-surface` padding change belongs here (roadmap §2.10 density) and its impact on the ~35 users of the token and on any spec asserting it.
  - Whether `flex flex-col` on the shared dialog panel changes layout for the 23 ConfirmDialog call sites.
  - Whether Popover (0 production consumers) needs anything beyond inheriting the menu panel class, and whether QueryStateCard needs any change beyond inheriting EmptyState.
  - Which existing specs pin old classes (e.g. `ps-8` on dropdown items, `rounded-md`, `text-base` titles, `bg-overlay/40`, `shadow-md`) and must follow the token change with their intent preserved.
- Independent QA watch items relevant here (`.squad/plans/crm-ui-ux-redesign/qa-review.md`, read-only): `.focus-ring` must keep `ring-offset-surface` (indigo ring vs indigo fill); no translucent foreground text; no `*-solid` steps as text.
- Visual evidence is captured with the track's ad-hoc Playwright harness (outside the repo): 320/768/1280 × en/ar × light/dark, with per-shot overflow, `h1`, `dir` and `data-theme` checks. A screen that opens a ConfirmDialog/Select/DropdownMenu should be inspected open, not only closed.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Files in scope: `packages/ui/src/lib/{menu,overlay}.ts`; `packages/ui/src/components/{card,dialog,alert-dialog,confirm-dialog,dropdown-menu,popover,select,tooltip,skeleton,empty-state,query-state-card}.tsx` and their `*.spec.tsx`; `packages/config/tailwind-{tokens.css,preset.js}` only if a token value or keyframe must change.
- Existing specs: `card`, `confirm-dialog`, `dialog`, `dropdown-menu`, `empty-state`, `popover`, `query-state-card`, `select`, `skeleton`, `tooltip` (`packages/ui/src/components/*.spec.tsx`); guards `apps/web/src/test/{style-guard,token-contrast}.spec.ts`, `apps/{web,portal}/src/design-tokens.spec.ts`.
- RTL centring precedent: `overlay.ts` uses `start-1/2` + `-translate-x-1/2` + `rtl:translate-x-1/2`; keep it.
- Every new named class must resolve through `cn` (tailwind-merge registration exists for all scales used).
- Verification commands: `pnpm --filter @crm/ui test`, `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal test`, `pnpm --filter <pkg> typecheck`, `pnpm --filter <pkg> lint`, `pnpm --filter @crm/web build`, `pnpm --filter @crm/portal build` (~17 min each on this machine), `git diff --check`, and a path-scoped diff review. Clear `apps/*/.next/cache/webpack` before visual checks on dev servers after preset/token changes.

## Out of scope

- What this story explicitly does **not** cover:
  - `Sheet` / drawer primitive (RD-6.1).
  - `SectionCard` `collapsible` option (RD-3.3).
  - Page-shaped skeleton recipes (RD-3.12).
  - Table, Toast, Avatar/BackLink/DescriptionList and other primitives (RD-1.11–RD-1.13).
  - `ErrorState` and error boundaries (RD-2.5).
  - Migrating any screen to dialogs or changing where dialogs are used (Phase 4/6).
  - Folding the web `ConfirmDialog` wrapper into @crm/ui (it supplies translations; it stays).
  - Any new dependency (no `tailwindcss-animate`, no colour library).
  - Backend, API, database, auth/authz, routing or business-rule changes.
