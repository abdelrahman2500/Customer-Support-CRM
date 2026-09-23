# Story intake

## Feature

- **Feature name (display):** Make the agent workspace header safe below `sm`
- **Feature slug (folder under `plans/`):** `make-the-agent-workspace-header-safe-below-sm`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

Make the agent workspace header safe below sm

## Description

Browser verification performed after Stories 168–172 found a real responsive defect in the authenticated agent workspace shell: the header overflows the viewport horizontally at 320px, in both English and Arabic, across authenticated agent routes.

Measured at 320×640 against a production build at HEAD `b13b35b`:

|                                        | EN       | AR       |
| -------------------------------------- | -------- | -------- |
| `document.documentElement.scrollWidth` | **354**  | **367**  |
| `document.documentElement.clientWidth` | 320      | 320      |
| overflow                               | **34px** | **47px** |

The overflow amount is **constant across routes** whose page headings range from 7 to 22 characters, which is what establishes that it comes from shared shell chrome rather than from any page's own content. Story 170's larger page/section headings were separately confirmed **not** to be the cause: they are `h1`/`h2`, while every measured offender is `text-sm` header chrome, and no heading was clipped or collided with its actions in a 40-case EN/AR sweep.

### Affected component

`apps/web/src/components/workspace/workspace-header.tsx`

Exported component:

`WorkspaceHeader`

### Current behavior

The header is a single **non-wrapping** flex row. Measured element-by-element at 320px (`scrollWidth` includes the start padding but not the clipped trailing padding, which is why the totals below land exactly on the observed figures):

| part                                           | EN      | AR      |
| ---------------------------------------------- | ------- | ------- |
| header `padding-inline` (`px-6`), leading edge | 24      | 24      |
| brand `<img className="h-8 w-auto">`           | 57      | 57      |
| controls cluster `<div>`                       | 273     | 286     |
| **total**                                      | **354** | **367** |

Controls cluster breakdown: identity `<span>` 86 + language `<select>` 84 + sign-out `Button` 71 (EN) / 83 (AR) + two `gap-4` = 32.

Contributing facts, each verified by reading the current source:

- The `<header>` row (~line 183) is `flex items-center justify-between … px-6` and carries **no** `flex-wrap`. A grep of that row for `sm:`/`md:`/`lg:`/`hidden`/`min-w-0`/`shrink`/`flex-wrap` returns nothing — it has no responsive treatment at all.
- The controls cluster (~line 198) is `flex items-center gap-4` with **no** `min-w-0`. The identity `<span>` does shrink (86px, wrapping), but the `<select>` and the `Button` cannot, so the cluster has a hard floor of ~273px (EN) / ~286px (AR).
- The brand `<img>` (~line 186) is `h-8 w-auto` with **no** width bound, so it claims 57px of the 320px budget.

### Why this matters beyond the measured case

Removing the logo alone currently brings the row back inside the viewport (EN 24 + 273 = 297; AR 24 + 286 = **310**, i.e. only **10px** of slack). Two ordinary states erase that slack:

1. **A configured logo.** Any branch with branding set contributes unbounded width.
2. **The branch switcher.** It renders only when `memberships.length > 1`. The account used for measurement has a single membership, so the switcher was **absent** from every figure above; present, it adds roughly another 100px.

So the row is structurally unsafe at narrow widths, and the logo is what happens to tip it today. The fix must hold for the multi-membership state, which no current measurement or test exercises.

### Desired behavior

Make the header wrap instead of overflow, and give its parts the shrink discipline the row currently lacks, so the shell is safe at ≤320px in both locales while remaining visually unchanged wherever the content already fits.

Navigation is deliberately **not** part of this: `workspace-navbar.tsx` (~line 50) and `workspace-sidebar.tsx` (~line 87) are already `hidden … sm:flex`, and the header's own hamburger (`sm:hidden`) serves both layouts below `sm`. RM-10/RM-11 made the navigation responsive and never came back for the header's identity/controls row — this story is that missing half.

## Implementation direction

The portal has already solved this exact problem and is the precedent to follow. `apps/portal/src/components/portal/portal-header.tsx` (~line 174) is:

```
flex flex-wrap items-center justify-between gap-y-2 …
```

and its own doc comment (~lines 64–70) records the same finding in the same words: _"no `flex-wrap` on either the header or the nav, so it genuinely overflowed the viewport at mobile widths with no visible scroll affordance."_

One correction to avoid copying the wrong thing: in the portal it is the **`<nav>`** that is `hidden sm:flex` (~line 214), **not** the language/sign-out cluster — that cluster stays visible in both apps. The decisive difference is `flex-wrap` + a row gap on the header element itself.

Three changes, all in `workspace-header.tsx`:

1. **`flex-wrap` plus a row gap on the `<header>`.** This is the primary structural behavior. Express the row gap with the existing spacing token rather than a raw step — `--space-inline` is exactly the `0.5rem` the portal spells `gap-y-2`, so the token-compatible form of the same value is available and should be preferred.
2. **`min-w-0` on the controls cluster, and `min-w-0` + truncation on the identity `<span>`**, so the one genuinely elastic item yields first and the unshrinkable controls are never the thing that forces overflow.
3. **A width bound on the brand `<img>`**, giving it the same discipline the text brand `Link` already has via `truncate` — whose own existing comment already reasons about free text that would otherwise "push the header's controls off-screen on a narrow viewport". Constrain only as far as narrow-screen safety requires; do not needlessly change the logo's natural desktop presentation.

### Candidate fixes already trialled

Applied in-page during recon at 320px (no files changed), for evidence only — the implementation is not required to match these exactly:

| trial                                                           | EN        | AR                                    |
| --------------------------------------------------------------- | --------- | ------------------------------------- |
| baseline                                                        | 354 ✗     | 367 ✗                                 |
| header `flex-wrap` + row gap                                    | **320 ✓** | **320 ✓**                             |
| bound the image only                                            | 320 ✓     | 320 ✓                                 |
| `flex-wrap` + bounded image + `min-w-0`/truncate on the cluster | **320 ✓** | **320 ✓**                             |
| hide the whole cluster below `sm`                               | 320 ✓     | 320 ✓ — **rejected, see constraints** |

### RTL

The defect is identical in both directions; Arabic is worse by 13px purely from string width (`"مسجّل الدخول باسم {name}"` vs `"Signed in as {name}"`, and `"تسجيل الخروج"` 83px vs `"Sign out"` 71px). No RTL-specific logic is implicated — `justify-between`, `px-6` and `gap-4` are all direction-neutral.

Two RTL notes for whoever implements and tests this:

- The fix must stay purely logical/flex. No physical-direction utility may be introduced (the repository already guards this in `workspace-sidebar.spec.tsx` ~lines 326–341).
- Under `dir="rtl"` the overflow extends to the **left**, so a scan for elements whose `right` edge exceeds the viewport reports **zero** offenders while `scrollWidth` is still 367. Any measurement helper must compare `scrollWidth` against `clientWidth`, not element right edges.

## Important design constraints

- **`flex-wrap` is the primary structural behavior.** Wrapping, not hiding, not scrolling.
- **Do not solve the problem by hiding controls.** Every header control stays present and operable below `sm`.
- **Do not override `Button`'s existing `whitespace-nowrap`.** It comes from the shared `Button`'s own cva base class and is correct — it is precisely _why_ the row must wrap rather than compress.
- **No physical-direction utilities**; preserve RTL through logical/flex layout.
- **Reuse the existing gap / `min-w-0` / `truncate` / token vocabulary.** No new token, no new primitive.
- **Preserve desktop and tablet appearance when the content fits.** `flex-wrap` is inert while content fits, so this should hold by construction — but it must be asserted, not assumed.

## Acceptance criteria

1. At 320×640 in the authenticated agent workspace, EN: `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
2. The same holds at 320×640 in AR.
3. The same holds when the branch switcher is present (a user with multiple branch memberships).
4. All header controls remain present and operable below `sm`: the signed-in identity, the branch selector when applicable, the language selector, and sign out.
5. No control is hidden merely to solve overflow.
6. The header wraps cleanly when wrapping is required.
7. At 834px and 1440px, behavior and appearance remain unchanged when the content fits.
8. No physical-direction utility is introduced.
9. No file outside `workspace-header.tsx` changes, except its own focused regression test.
10. Existing desktop, tablet and RTL behavior remains intact.

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** None. Stories 168–172 are complete; this was found by the browser verification pass that followed them, and depends on none of their code.
- **Depends on code areas or other stories:**

  - `apps/web/src/components/workspace/workspace-header.tsx` — the only file to change.
  - `apps/web/src/components/workspace/workspace-header.spec.tsx` — its focused regression test.
  - `apps/portal/src/components/portal/portal-header.tsx` — the precedent, read-only.
  - Story RM-10 / RM-11 — the responsive-navigation work that established the pattern and stopped short of this row.
  - Story 129 — the branding-driven header (`appName`, `logoUrl`, `primaryColor`) and the branch switcher's multi-membership condition.
  - Story 134 — the spacing token vocabulary this fix should spend.

## Extra notes

- The overflow is **not** caused by Story 170's type scale. This was checked directly: the offenders are `text-sm` header chrome, the overflow is constant across routes with very different heading lengths, and a 40-case EN/AR sweep found `collide=false` and `clipped=false` for every page heading.
- The **portal is explicitly not part of this story**, and its header already wraps. Recon did note, code-level only and **not** browser-measured, that the portal's left group carries the same two unbounded pieces (an `h-8 w-auto` logo `<img>` and a contact-name `<Link>` with no `truncate`/`min-w-0`), contained today by its `flex-wrap`. If that is worth hardening it belongs in its own story.
- Measuring the portal's authenticated header would require seeding a portal contact with a password, i.e. writing unrelated fixture data. That was deliberately not done and is not required here.

## Technical hints

- **Header row:** `apps/web/src/components/workspace/workspace-header.tsx` ~line 183.
- **Brand image:** ~line 186 (`h-8 w-auto`). **Text brand fallback:** ~lines 188–196, whose `truncate` comment already states the "push the header's controls off-screen" reasoning to mirror.
- **Controls cluster:** ~line 198. **Identity span:** ~line 199. **Branch switcher:** ~lines 200–223 (renders only when `memberships.length > 1`). **Language switcher:** ~lines 229–241. **Sign out:** ~line 240.
- **Portal precedent:** `apps/portal/src/components/portal/portal-header.tsx` ~line 174, and its doc comment ~lines 64–70.
- **Already-correct navigation, do not touch:** `workspace-navbar.tsx` ~line 50, `workspace-sidebar.tsx` ~line 87, and the header's own `sm:hidden` hamburger block.
- **`min-w-0` precedent in this shell:** `workspace-shell.tsx` ~lines 75–88, where `<main>` already carries `min-w-0` for the sibling flex-shrink problem, with the reasoning written out.
- **Direction-safety test idiom:** `apps/web/src/components/workspace/workspace-sidebar.spec.tsx` ~lines 326–341.
- **Spacing tokens:** `packages/config/tailwind-preset.js` ~lines 164–172 (`tight`/`inline`/`stack`/`surface`/`shell`/`field-x`/`field-y`).
- **Existing header tests:** `apps/web/src/components/workspace/workspace-header.spec.tsx` — note the existing `describe("branch switcher (Story 118)")` block (~line 487), which already sets up a multi-membership fixture and is the natural place to extend for criterion 3.

## Testing requirements

Add focused structural tests to the existing `workspace-header.spec.tsx`, following this repository's conventions. Do **not** add new Playwright infrastructure in this story.

At minimum verify:

1. The `<header>` carries `flex-wrap` and a row gap.
2. The controls cluster is shrinkable (`min-w-0`).
3. The identity text is the elastic/truncatable item.
4. The brand image carries its width bound.
5. With multiple memberships, the branch selector is **still present** alongside the identity text, the language selector and sign out — the test that would catch a "fix" implemented by hiding controls. Extend the existing multi-membership fixture rather than building a new one.
6. The direction-safety guard: no `ml-`/`mr-`/`pl-`/`pr-`/`text-left`/`text-right` utility on the header subtree.

**Why these are class/structure-level assertions.** jsdom loads no Tailwind CSS, so a computed-width or `scrollWidth` assertion cannot distinguish a fixed layout from a broken one there. The repository has already recorded this exact constraint twice — in `packages/ui/src/lib/cn.spec.ts` and in Story 169's `Button` guard — and resolved it the same way: assert the mechanism at class level, and prove the behavior in a real browser. Follow that precedent rather than inventing a jsdom layout assertion that would pass against the bug.

Prefer accessible queries for the presence assertions (`getByRole("combobox", { name })`, `getByRole("button", { name })`) and reserve class-level assertions for the structural mechanism that no behavioral query can reach.

## Verification expectations

The eventual implementation should verify:

- Existing tests preserved — none weakened, skipped or deleted.
- Focused web tests pass (`pnpm --filter @crm/web test`).
- Repository `pnpm typecheck`, `pnpm lint`, `pnpm build` remain green.
- `git diff` limited to `workspace-header.tsx` and its spec.
- **Real-browser manual verification after implementation**, at: 320px EN, 320px AR, 834px EN and AR, 1440px EN and AR — and in the branch-switcher state **if the existing fixture/setup permits it without creating unrelated data**. Each viewport checked with `scrollWidth === clientWidth`, not by eye alone and not by element right edges (see the RTL note above).
- Do **not** commit or push as part of the intake task that produced this document.

## Out of scope

- The portal header.
- `WorkspaceShell` and `<main>`.
- Navigation, navbar or sidebar changes.
- Branding fallback behavior, including any `onError`/dead-`logoUrl` handling.
- Branding data cleanup.

  The broken logo currently visible in the development environment is **not** a product defect: `admin.branding_configs.logo_url` holds `https://example.com/logo-<uuid>.png`, which is the fixture URL `apps/api/scripts/with-test-db.mjs`'s own doc comment records `branding.e2e-spec.ts` leaving behind before the test-database isolation fix. Bounding the image width is in scope **only** because unbounded image width contributes to the responsive layout defect. Do not implement an image error fallback.

- New design tokens or primitives.
- A general responsive audit beyond this header.
- New Playwright infrastructure.
- API, backend, RBAC, database or migration changes.
