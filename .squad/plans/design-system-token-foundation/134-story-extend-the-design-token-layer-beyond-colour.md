# Story 134 — Extend the design token layer beyond colour

## Prerequisites

- **Story S-1 / DS-1a / DS-1b completed** — the semantic token layer. DS-1a (commit `76b3598`) extracted the shared Tailwind *theme* into `packages/config/tailwind-preset.js`; DS-1b (commit `7f42fb8`) extracted the CSS custom-property *values* into `packages/config/tailwind-tokens.css`. **Neither has a formal `.squad` plan artifact** — both are `_(unplanned)_` rows in `.squad/plans/00-index.md` (lines 130 and 132). The closest sibling *plan* precedent for how this repository treats the token system is [`../admin-branding-navigation/129-story-admin-branding-navigation.md`](../admin-branding-navigation/129-story-admin-branding-navigation.md); see its Prerequisites (line 9) and its `--accent` deferral (line 30).
- **Story 129 completed** — the workspace shell and `nav-items.tsx`. **Untouched by this story.**
- **Token guards in place** — `apps/web/src/design-tokens.spec.ts` and `apps/portal/src/design-tokens.spec.ts`. Both must keep passing **unmodified**.
- No cross-team coordination required: `@crm/config` has no consumer outside this monorepo.

---

## Story Goal

Give this design system a **named vocabulary for the dimensions that are not colour** — spacing, radius and elevation — through the mechanism that already carries colour and type, so the later adoption stories (DS-B…DS-E) have something to spend instead of re-deciding raw utilities per file.

This is a **pure vocabulary story**: it adds names for values the codebase already uses. It does not apply them.

**Explicitly not in scope**, because ambiguity is likely:

1. **No component migration** — no `.tsx` under `apps/web`, `apps/portal` or `packages/ui` changes.
2. **No visual change.** A rendered screen must be identical before and after. This is the load-bearing constraint, and **Verification Step 4 proves it rather than asserting it**.
3. **No new type scale** — one already exists; see the correction below.
4. **No dark mode**, **no branding `primaryColor` → `--accent`**, **no auth/permission change**, **no navigation change**, **no RTL change**.
5. **No changes to the colour tokens** (`tailwind-tokens.css` lines 37–128) in name, value or meaning.
6. **No charting library, no Drawer/Sheet primitive, no cross-app consolidation** — all later, separate stories.

### Correction carried from discovery — read before planning any typography work

The recon that approved this story reported "no typography tokens." **That was wrong.** A named 7-step scale already exists at **`packages/config/tailwind-preset.js` lines 139–147**: `caption`, `label`, `body-sm`, `body`, `subhead`, `heading`, `title`, each with size and line-height, and where relevant letter-spacing and font-weight.

Measured across `apps/web/src`, `apps/portal/src` and `packages/ui/src`: **all seven have zero usages.** The JSDoc directly above it (lines 130–138) states the intent — *"Nothing is re-typeset by this file: applying them is a shared `PageHeader`'s job (NAV-2), and `text-sm` remains the body size until then."*

**Do not redefine, rename or "improve" the type scale in this story.** Document it so it is discoverable; leave adoption to its own story. A second competing scale is exactly the drift this feature exists to prevent.

---

## Context — Read These Files First

1. **`packages/config/tailwind-tokens.css`** (233 lines total) — the file this story extends.
   - **Lines 1–34** — the DS-1b/S-1 header. Two rules bind this story: *"Channels, not colours"* (lines 23–28) — every colour token holds space-separated RGB channels so `rgb(var(--token) / <alpha-value>)` keeps Tailwind's opacity modifiers working; and *"Light theme only, deliberately"* (lines 30–33) — dark mode is a second `:root` block for a later story. **Match this comment style: every block explains *why*, not just *what*.**
   - **Line 35–36** — `@layer base { :root {` — the block new tokens go inside.
   - **Lines 37–128** — the 55 colour tokens in banner-comment groups: surface (40–42), ink (50–53), rule (58–60), accent (69–72), overlay (78), focus (89), and the four status families (100–128). **Structural pattern to mirror. Do not modify any line in this range.**
   - **Lines 130–136** — the radius block. Read the comment: it records that Tailwind's radius scale was *deliberately left alone* because `rounded-md` (0.375rem) "is already used 149 times and is correct," and remapping it "would have been a silent visual change across the whole app for no gain." **Binding: radius work is additive naming only, never a remap.** `--radius: 0.375rem;` is at line 136.
   - **Lines 138–170** — the shadcn/ui compatibility aliases (`--background`, `--card`, `--popover`, `--primary`, `--destructive`, `--border`, `--input`, `--ring`). Line 171 closes `:root`. Understand these before adding siblings.
   - **Lines 173–184** — the `body` rule, deliberately `--surface` not `--surface-sunk`.
   - **Lines 186–233** — `@layer components`: `.focus-ring` (202–204), `.focus-ring-always` (212–214), `.skip-link` (229–232). **Do not touch.**
2. **`packages/config/tailwind-preset.js`** (150 lines total).
   - **Lines 30–39** — records that `content` stays in each app's config because `apps/web/src/test/tailwind-content.spec.ts` asserts on `config.content` directly.
   - **Lines 42–50** — the `token()` helper: `` const token = (name) => `rgb(var(--${name}) / <alpha-value>)` ``. Colour tokens go through it; **spacing/radius/shadow must not** — they are not RGB channels.
   - **Line 52** — `/** @type {…["theme"]}["extend"]} */`; **line 53** — `const sharedThemeExtend = {`; **line 150** — `module.exports = sharedThemeExtend;`.
   - **The only three keys today: `colors` (line 59), `fontFamily` (line 126), `fontSize` (line 139).** You are adding siblings to these.
   - **Lines 139–147** — the existing type scale. Read it; do not change it.
3. **`apps/web/tailwind.config.ts`** (33 lines) — confirms the wiring: line 2 `import sharedThemeExtend from "@crm/config/tailwind-preset";`, lines 26–28 `theme: { extend: sharedThemeExtend }`, line 25 the `content` globs that also scan `../../packages/ui/src`. **Lines 4–8 carry the RTL convention** (prefer `ms-*`/`me-*`/`ps-*`/`pe-*` over physical utilities) — do not disturb it.
4. **`apps/portal/tailwind.config.ts`** — the mirror. Line 2 imports the same preset; line 27 `extend: sharedThemeExtend`. Confirms both apps pick up new keys automatically.
5. **`apps/web/src/app/globals.css`** and **`apps/portal/src/app/globals.css`** — each `@import`s the token CSS (portal line 15: `@import "../../../../packages/config/tailwind-tokens.css";`). Confirms new tokens reach both apps with no app-side change.
6. **`packages/config/package.json`** — lines 11–12 list `tailwind-preset.js` and `tailwind-tokens.css` in `files`. **If you add a new file, it must be listed here or it will not publish** — which is a reason to extend the existing two files rather than add a third.
7. **The guards** — `apps/web/src/design-tokens.spec.ts` and `apps/portal/src/design-tokens.spec.ts`. Read to understand what they forbid; **do not edit**. Note the portal's scope note (~line 29) that status families `amber`/`red`/`emerald` are exempt.
8. **Measured usage — derive the scales from these, do not invent values.** Run each and record the distribution:
   - Grep for `` `\b(p|px|py|pt|pb|ps|pe)-[0-9]+` `` in `apps/web/src` and `apps/portal/src`.
   - Grep for `` `\b(gap|space-y|space-x|mt|mb)-[0-9]+` `` in the same roots.
   - Grep for `` `rounded-(sm|md|lg|xl|full)` `` for the real radius distribution.
   - Grep for `` `shadow-(sm|md|lg)` `` for the real elevation distribution.
   - Known anchors, already counted at `2f7aec5`: the card surface `"rounded-md border border-rule bg-surface p-4"` appears **24 times verbatim**; the input/textarea surface `"… rounded-md border border-rule-strong bg-surface px-3 py-2 text-sm shadow-sm …"` **7 times verbatim** plus 2 drifted copies.

---

## Implementation tasks

**No backend changes required.** Nothing under `apps/api` or `apps/worker` is touched.

### 1 — Derive the scales from measured usage

Run the greps in Context item 8 **before writing any token**, and record the distribution in the completion report. The scales must *describe what the codebase already does*. A scale that does not match existing usage guarantees either a visual change here (forbidden by the Story Goal) or a vocabulary nobody can adopt later without a redesign.

Concretely: if `p-4` dominates card padding, the card-padding token **is** `1rem` — not `0.875rem` because that is prettier.

### 2 — Add a spacing block

**File: `packages/config/tailwind-tokens.css`**

Insert a new banner block **after line 136** (`--radius: 0.375rem;`) and **before line 138** (the shadcn alias banner), inside the `:root` that closes at line 171. Match the `/* ---- */` banner style used at lines 37, 44, 55, 62, 80, 91, 130.

Define semantic spacing custom properties for the **recurring surfaces**, not a generic 1–12 ramp (Tailwind already ships that):

- a card/panel padding value,
- a vertical stack gap,
- an inline control gap,
- the field padding pair (the `px-3 py-2` input rhythm).

Each token's comment states **which existing pattern it names and the count** — e.g. "names the `p-4` shared by the 24 verbatim card surfaces."

**These are lengths, not colours: plain values (`1rem`), not `token()`-wrapped RGB channels.**

### 3 — Add semantic radius tokens

**File: `packages/config/tailwind-tokens.css`**

Extend the block at lines 130–136. **Keep `--radius: 0.375rem;` (line 136) byte-for-byte** — it is the shadcn compatibility anchor referenced by the aliases below it. Add semantic siblings for the corner roles the grep in Context item 8 actually finds (e.g. a control radius, a surface radius, a pill radius if `rounded-full` appears).

The existing comment's reasoning is binding: **additive names only, never a remap of Tailwind's `rounded-md`.**

### 4 — Add semantic elevation tokens

**File: `packages/config/tailwind-tokens.css`**

Add an elevation banner block naming the levels already in use — at minimum the resting elevation used by inputs and card surfaces (today bare `shadow-sm`) and the overlay elevation used by dialogs, popovers and dropdowns.

**Before naming the overlay level, read what those components actually render:** `packages/ui/src/components/dialog.tsx`, `popover.tsx`, `dropdown-menu.tsx`. Name what is there; do not introduce a new shadow.

If an elevation needs a tint, reference an existing colour token (e.g. `--overlay`, line 78) rather than a new literal.

### 5 — Expose the new tokens through the preset

**File: `packages/config/tailwind-preset.js`**

Add `spacing`, `borderRadius` and `boxShadow` keys to the `sharedThemeExtend` object (opens line 53, exported line 150), as siblings of `colors` (59), `fontFamily` (126) and `fontSize` (139). Each maps a utility name to `var(--token)`.

**Do not route these through `token()` (line 50)** — that helper emits `rgb(… / <alpha-value>)` and is for colour channels only.

**Obey the additive contract.** This object is spread into each app's own `theme.extend` (`apps/web/tailwind.config.ts` lines 26–28; `apps/portal/tailwind.config.ts` line 27). Because these are `extend` entries they *add* names — but a key that reuses an existing Tailwind name **overrides** it. So: **do not define `spacing.4`, `borderRadius.md`, or `boxShadow.sm`.** Every existing `p-4`, `gap-2`, `rounded-md`, `shadow-sm` in both apps must resolve exactly as today. That is what keeps this story visually inert.

Document each new key with a JSDoc in the style of the `fontSize` block (lines 130–138), including **that the steps are intentionally unadopted pending a later story**.

### 6 — Document the vocabulary, including the pre-existing type scale

**File: `packages/config/tailwind-tokens.css`** (and/or the preset — put it where the next reader will look)

Record in one place: the spacing / radius / elevation names added here, **plus a pointer to the 7-step type scale at `tailwind-preset.js` lines 139–147**. The single most valuable output of this story is that the next author can discover the whole vocabulary without grepping — the type scale went unused partly because nothing advertised it.

### 7 — No markup changes

Do not modify any `.tsx` in `apps/web`, `apps/portal` or `packages/ui`. Both `tailwind.config.ts` files already spread the preset (Context items 3–4), so **no app-side change should be required**. If discovery proves otherwise, **call it out explicitly in the report** rather than folding it in silently.

**Do not add a new file to `packages/config`** — `package.json` lines 11–12 enumerate the published files, and a third file would need adding there. Extend the two that exist.

---

## Edge Cases & Failure Modes

- **Trigger: the new `spacing` key defines a numeric name such as `4`.** `theme.extend.spacing["4"]` overrides Tailwind's default, so every `p-4`/`gap-4`/`mt-4` across both apps silently changes — a repo-wide visual regression. **Expected:** only semantic names are defined. **Enforced at:** `packages/config/tailwind-preset.js` (the `sharedThemeExtend` object, lines 53–149); proven by Verification Step 4.
- **Trigger: `borderRadius` extension defines `md`.** All 149 `rounded-md` usages change corner radius at once. **Expected:** `md` untouched; new names only. **Enforced at:** the radius comment, `tailwind-tokens.css` lines 130–135, which already records this exact hazard.
- **Trigger: `boxShadow` extension defines `sm`.** Every bare `shadow-sm` — including the 7 verbatim input surfaces — changes. **Expected:** `sm` untouched.
- **Trigger: `--radius` (line 136) is renamed or re-valued.** The shadcn aliases (lines 138–170) and anything scaffolded by the shadcn CLI break. **Expected:** unchanged byte-for-byte.
- **Trigger: a spacing/radius/shadow token is wrapped in `token()`.** Emits `rgb(1rem / <alpha>)` — invalid CSS, silently dropped. **Expected:** `token()` (line 50) is used for colour channels only.
- **Trigger: a colour token (lines 37–128) is reordered, renamed or re-valued while editing the same file.** Both apps regress, and the guards may not catch a *rename* — they scan for raw palette classes, not token names. **Expected:** that range is untouched; confirm with a targeted `git diff`, not a glance.
- **Trigger: the type scale is "tidied."** Silently changes any future adoption and contradicts the preset's own stated intent. **Expected:** `fontSize` (lines 139–147) byte-identical after this story.
- **Trigger: a token is added to the CSS file but not exposed in the preset, or vice-versa.** A half-wired vocabulary that looks available but is not. **Expected:** every new token reachable as a utility **from both apps** — Verification Step 3 checks from each app, not just from `packages/config`.
- **Trigger: a new file is added to `packages/config` without updating `package.json` `files` (lines 11–12).** It is silently absent when the package is consumed. **Expected:** no new file.
- **Trigger: `packages/ui` fails to resolve the extended theme.** Its components are scanned via each app's `content` glob (`apps/web/tailwind.config.ts` line 25). **Expected:** covered by a full `pnpm build`, not an app-only build.

---

## Test Plan

This story adds no runtime behaviour, so it adds **no new unit tests of its own**. What matters is **non-regression**, proven rather than asserted.

1. **`apps/web/src/design-tokens.spec.ts`** — must pass **unmodified**. Additionally confirm the guard can still *fail*: temporarily reintroduce a raw neutral palette class, see it fail, revert. A guard that cannot fail is not a guard.
2. **`apps/portal/src/design-tokens.spec.ts`** — same.
3. **`apps/web/src/test/tailwind-content.spec.ts`** — asserts on `config.content` directly (per `tailwind-preset.js` lines 30–33). Must pass unchanged; it is the existing guard on app-level Tailwind config.
4. **`packages/ui/src/components/*.spec.tsx`** — several assert on resolved classes (e.g. `badge.spec.tsx` asserts each variant's colour comes from an S-1 family). All must pass unchanged; they are the closest thing to a visual contract in this repo.
5. **Full app suites** — `apps/web` and `apps/portal`. Any failure means markup was touched, which this story forbids.
6. **Optional, only if free:** a spec asserting the preset still exports `colors`/`fontFamily`/`fontSize` with the 7 type-step names intact would pin Edge Case 7 permanently. **`packages/config` has no Vitest project today — if adding this requires standing up one, skip it** and rely on Verification Step 6. The cost is not justified for one story.

**Do not** add rendered-component snapshot tests here; that belongs to DS-B, once components actually consume the tokens.

---

## Verification Steps

1. **Packages build:** `pnpm build` from the repo root — expect 6/6 tasks. Confirms `packages/ui`, `apps/web` and `apps/portal` all resolve the extended theme.
2. **Static checks:** `pnpm typecheck` (expect 10/10) and `pnpm lint` (expect 10/10), both from the repo root.
3. **Frontend runs:** `pnpm --filter @crm/web test` and `pnpm --filter @crm/portal test`. Both green, **with no spec file edited**.
4. **Regression — prove the "no visual change" claim.** Assertion is not acceptable. Build the CSS at `HEAD` and after the change, then diff the two stylesheets. **The only differences may be *added* utility definitions.** No existing utility — `.p-4`, `.gap-2`, `.rounded-md`, `.text-sm`, `.shadow-sm` — may have a changed declaration. Record the diff summary in the report.
5. **Regression — colour tokens untouched:** `git diff packages/config/tailwind-tokens.css` and confirm **no line between 37 and 128** is modified, and that line 136 still reads `--radius: 0.375rem;`.
6. **Regression — type scale untouched:** `git diff packages/config/tailwind-preset.js` and confirm **lines 139–147** are byte-identical.
7. **Regression — RTL:** grep both `src` roots for physical-direction classes (`ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `border-l`, `border-r`). Must remain **0**, as it is at `2f7aec5`.
8. **Scope:** `git status --short` — the changed set should be `packages/config/tailwind-tokens.css`, `packages/config/tailwind-preset.js`, and `.squad` artifacts. **Any `.tsx` in the list means the story overran.**

---

## Done Criteria

- [ ] A documented **spacing** block exists in `packages/config/tailwind-tokens.css`, values derived from measured usage, each comment citing the pattern it names.
- [ ] Semantic **radius** tokens added; `--radius: 0.375rem;` (line 136) unchanged and Tailwind's `rounded-md` not remapped.
- [ ] Semantic **elevation** tokens added, covering at minimum the resting (input/card) and overlay (dialog/popover/dropdown) levels, named after what those components actually render.
- [ ] `packages/config/tailwind-preset.js` exposes them via **additive** `spacing`, `borderRadius` and `boxShadow` keys in `sharedThemeExtend`; **no key shadows a Tailwind default** (`spacing.4`, `borderRadius.md`, `boxShadow.sm`).
- [ ] No spacing/radius/shadow token is routed through the colour-only `token()` helper (line 50).
- [ ] The **pre-existing 7-step type scale (lines 139–147) is unchanged** and is now documented/discoverable alongside the new scales.
- [ ] The **colour tokens (lines 37–128) are byte-for-byte unchanged**.
- [ ] **No `.tsx`** in `apps/web`, `apps/portal` or `packages/ui` modified; **no new file** added to `packages/config`.
- [ ] **No rendered styling changed** — proven by the compiled-CSS diff in Verification Step 4, not asserted.
- [ ] Both `design-tokens.spec.ts` guards pass **unmodified**, and still fail on reintroduced raw palette.
- [ ] Zero physical-direction classes; the logical-property approach is untouched.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` clean; web and portal suites pass unchanged.
- [ ] No dark mode, no `primaryColor` → `--accent` wiring, no auth/permission change, no navigation change, no charting/Drawer/consolidation work.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 135.**
