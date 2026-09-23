# Story intake

## Feature

- **Feature name (display):** Harden fixed-width form controls for narrow viewports
- **Feature slug (folder under `plans/`):** `harden-fixed-width-form-controls-for-narrow-viewports`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

Harden fixed-width form controls for narrow viewports

## Description

The post-Story-173 recon swept **23 authenticated agent routes × EN/AR at 320×640** against a production build at `dee4256`. Story 173 fixed the shell, and the sweep now reports **22/23 clean in both locales**. Exactly one route still overflows, and it does so identically in both:

| route | locale | `scrollWidth` / `clientWidth` |
| --- | --- | --- |
| `/quick-replies` | EN | **329** / 320 |
| `/quick-replies` | AR | **329** / 320 |

### Root cause

`apps/web/src/components/quick-replies/quick-replies-view.tsx` line **195** renders `<Input … className="w-72" />`. `w-72` is **288px**, fixed. The control sits inside a `SectionCard` (line 186) whose content box measures **272px** at a 320px viewport, so the input is wider than its own container:

```
en: inputW=288  cardW=272  overflowsCard=true  doc=329  vw=320
ar: inputW=288  cardW=272  overflowsCard=true  doc=329  vw=320
```

The form is rendered unconditionally inside `SectionCard` — it is **not** behind an "Add"/"New" toggle — so every user on a narrow screen reaches it.

### The wider pattern

`w-72` is the only site the sweep could prove, but it is one of **25 fixed-width form controls across 12 files** in `apps/web`, against only **5** sites using the repository's own guarded idiom `w-full sm:w-auto sm:min-w-[10rem]` (and the portal's correctly-guarded `sm:w-64`).

Available width at 320px: the page `<main>` carries `p-6` (272px content), and a `SectionCard` adds `p-surface` (240px inside). So:

| class | px | inside `<main>` (272) | inside a card (240) |
| --- | --- | --- | --- |
| `w-72` | 288 | **overflows** | **overflows** |
| `w-64` | 256 | fits | **overflows** |
| `w-56` | 224 | fits | fits, no margin for a sibling |
| `w-48` | 192 | fits | fits |
| `w-40` | 160 | fits | fits |

The sweep only exercises what renders on page load; controls behind interactions (the automation-rules condition/action builders, inline edit rows) were never opened, so the measured count of one is a **lower bound**, not the true total.

### Why this does not contradict Story 150

Story 150 ("Responsive quality pass") explicitly investigated and rejected filter rows, with sound reasoning that still holds: *"Every `min-w-[10rem]` filter select sits in a `flex flex-wrap` (or `FilterBar`) container, so they wrap rather than overflow."* Re-confirmed during recon — `FilterBar` is `flex flex-col … sm:flex-row sm:flex-wrap`, so below `sm` its children stack full-width.

**`min-w-*` and fixed `w-*` are different classes.** A `min-w` control in a wrapping container is safe; a fixed `w-*` control cannot shrink at all, wherever it sits. Story 150's scan never covered fixed widths. This story closes that gap without reopening a rejected decision.

## Desired behavior

Every fixed-width form control becomes full-width below `sm` and keeps its current fixed width from `sm` up, using the guarded idiom the repository already uses in five places.

At ≥640px nothing changes at all: `w-full sm:w-56` and `w-56` resolve identically once the `sm` breakpoint is active.

## Implementation direction

Apply the existing idiom — `w-N` → `w-full sm:w-N` — to fixed-width **form controls** (`Input`, `Textarea`, `SelectTrigger`, `FormField` wrappers around them). Reuse what is already there; introduce no new class vocabulary.

**Not** in scope for the rewrite:

- `Skeleton` elements (`w-40`/`w-56` placeholders) — decorative, never interactive, and a full-width skeleton would misrepresent the control it stands in for.
- The mention-autocomplete `<ul className="… w-56 …">` in `ticket-detail-view.tsx` — an absolutely-positioned popover, not a form control in flow.
- `min-w-[10rem]` filter selects — Story 150's rejected candidate, re-confirmed safe.

## Acceptance criteria

1. At 320×640, `/quick-replies` reports `document.documentElement.scrollWidth === document.documentElement.clientWidth` in **EN**.
2. The same holds in **AR**.
3. The full 23-route × EN/AR sweep at 320×640 reports **23/23 clean** in both locales.
4. Every fixed-width form control in `apps/web` is full-width below `sm` and keeps its existing width from `sm` up.
5. At 834px and 1440px, EN and AR, appearance is unchanged.
6. No `Skeleton`, popover or `min-w-*` filter control is altered.
7. No physical-direction utility is introduced.
8. No new token, primitive or dependency.
9. Existing tests pass unmodified.

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** None. Story 173 (`dee4256`) is complete; this is the remaining item its own verification sweep surfaced.
- **Depends on code areas or other stories:**

  - `apps/web/src/components/quick-replies/quick-replies-view.tsx` — the proven case.
  - 11 further `apps/web/src/components/**` view files carrying the same pattern.
  - Story 150 — the responsive pass whose scan this extends (`min-w-*` vs fixed `w-*`).
  - Story 173 — established the browser-verification method used for acceptance.
  - RM-10 / `FilterBar` — the wrapping containers that make `min-w-*` safe and are deliberately untouched.

## Extra notes

- The repository's guarded idiom already exists at: `customers/customer-list-view.tsx` (×2), `knowledge-base/article-list-view.tsx`, `reporting/reports-view.tsx`, `tickets/ticket-list-view.tsx`, plus `packages/ui/src/components/filter-bar.tsx` line 64. Match it rather than inventing a variant.
- jsdom loads no Tailwind CSS, so no unit test can measure overflow. Structural/class-level assertions plus browser verification are the pattern this repository has settled on (`packages/ui/src/lib/cn.spec.ts`, Story 169, Story 173).

## Technical hints

- **Proven defect:** `quick-replies-view.tsx` line 195 (`w-72`), inside the `SectionCard` opened at line 186.
- **Remaining sites (25 controls / 12 files):** `audit-logs/audit-log-view.tsx` (2), `automation-rules/automation-rules-view.tsx` (7), `branches/branch-departments-view.tsx` (1), `business-hours/business-hours-view.tsx` (1), `customers/customer-detail-view.tsx` (4, one of which is the Story 170 inline-edit heading `w-56 text-title`), `kb-categories/kb-categories-view.tsx` (1), `notifications/notification-templates-view.tsx` (1), `quick-replies/quick-replies-view.tsx` (1), `reporting/reports-view.tsx` (3), `roles/role-list-view.tsx` (2), `ticket-categories/ticket-categories-view.tsx` (1), `tickets/ticket-chat-card.tsx` (1).
- **Guarded idiom to copy:** `className="w-full sm:w-auto sm:min-w-[10rem]"` / `sm:w-64`.
- **Verification method:** Story 173's — compare `scrollWidth` against `clientWidth`, never element right edges (under RTL the overflow extends left and a right-edge scan reports zero offenders).

## Testing requirements

- Add a focused structural test asserting the proven control is full-width below `sm` and retains its `sm:` width, following repository conventions.
- Do not add Playwright infrastructure.
- Existing tests must pass unmodified.

## Verification expectations

- `pnpm --filter @crm/web test`; portal and `@crm/ui` as regression checks.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Browser: re-run the 23-route × EN/AR 320px sweep and confirm 23/23 in both locales; spot-check 834 and 1440 for no visual change.
- `git diff` limited to the story's own files.

## Out of scope

- `Skeleton` widths, popover widths, `min-w-*` filter controls.
- The portal (its only fixed width, `sm:w-64`, is already guarded).
- Any change at `sm` and above.
- New tokens, primitives or dependencies.
- Dark mode, API, RBAC, database.
