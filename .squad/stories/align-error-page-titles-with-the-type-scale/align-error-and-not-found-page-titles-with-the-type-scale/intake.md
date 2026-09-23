# Story intake

## Feature

- **Feature name (display):** Align error and not-found page titles with the type scale
- **Feature slug (folder under `plans/`):** `align-error-page-titles-with-the-type-scale`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

Align error and not-found page titles with the type scale

## Description

Story 170 moved every page title onto the named type scale — `PageHeader`'s `h1` became `text-title` (1.5rem/600), and the three hand-rolled inline-editable detail titles followed. It scoped itself to `PageHeader`, `CardTitle` and those three views.

Six page titles were never in range and still carry the pre-170 size, so the product now renders page titles at **two** sizes:

| file | line |
| --- | --- |
| `apps/web/src/app/not-found.tsx` | 24 |
| `apps/web/src/app/[locale]/error.tsx` | 43 |
| `apps/web/src/app/[locale]/not-found.tsx` | 22 |
| `apps/portal/src/app/not-found.tsx` | 15 |
| `apps/portal/src/app/[locale]/error.tsx` | 35 |
| `apps/portal/src/app/[locale]/not-found.tsx` | 17 |

Each is `<h1 className="text-xl font-semibold text-ink">` — 1.25rem, against 1.5rem everywhere else. These are the error and not-found page shells, which `design-tokens.spec.ts` already names as legitimate non-`Card` surfaces; they were simply outside Story 170's scope.

Measured at HEAD `ef36416`: these six are the only remaining `text-xl` occurrences in either app, and there are zero remaining production `text-lg` heading usages.

## Desired behavior

All six render at `text-title`, matching every other page title in the product.

`font-semibold` is dropped alongside the size change: the `title` step declares `fontWeight: 600` in its own `fontSize` tuple, so keeping both would state the weight twice — exactly the reasoning Story 170 recorded when it made the same change in `PageHeader` and `CardTitle`.

## Acceptance criteria

1. All six `h1`s use `text-title text-ink`.
2. No `font-semibold` remains beside `text-title` on those elements.
3. No production `text-xl` or `text-lg` heading remains in either app.
4. Nothing else on those pages changes — copy, links, layout, landmarks and the `common.notFound.*` / `common.errorBoundary.*` keys are untouched.
5. Existing tests pass; `apps/web/src/app/not-found.spec.tsx` is the one spec that renders an affected page.
6. No new token, primitive or dependency.

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** None. Story 175 (`ef36416`) is complete and pushed.
- **Depends on code areas or other stories:**

  - Story 170 — established `text-title` as the page-title step and the "drop `font-semibold`" rule.
  - Story 134 — defined the scale.
  - `apps/web/src/app/not-found.spec.tsx` — the only existing spec covering an affected page.

## Extra notes

- This is deliberately a small consistency close-out, surfaced by the post-173 recon. It has low user impact — these are error paths — but it is the last inconsistency left from Story 170's scoping and costs one class per file.
- `error.tsx` renders only on a thrown render error, which is not reachable by ordinary navigation; the not-found pages are reachable by visiting any unknown path.

## Technical hints

- The exact string to replace in all six: `className="text-xl font-semibold text-ink"` → `className="text-title text-ink"`.
- `apps/web/src/app/not-found.tsx` and `apps/portal/src/app/not-found.tsx` are the root (non-localised) shells with hard-coded English copy — that copy is **not** in scope to change.

## Testing requirements

- Extend `apps/web/src/app/not-found.spec.tsx` with a focused assertion that the `h1` carries `text-title` and not `text-xl`.
- Do not add new spec files for the remaining five; they are the same one-class change and the repo does not currently have specs for them.

## Verification expectations

- `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal test`, `pnpm --filter @crm/ui test`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Browser: a not-found page in both apps, EN and AR, confirming the heading renders at 24px.
- `git diff` limited to the six files plus the one spec.

## Out of scope

- Page copy, links, layout or landmarks.
- The `error.tsx` retry behaviour.
- Any other type-scale step.
- New tokens, primitives or dependencies.
