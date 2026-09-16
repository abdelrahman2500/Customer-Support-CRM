> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked. 
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/design-system-token-foundation/extend-the-design-token-layer-beyond-colour/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Design System — Token Foundation (DS-A)
- **Feature slug (folder under `plans/`):** `design-system-token-foundation`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `134` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story` — design-system foundation
- **Status:** `Planned`
- **Assignee:** `(unassigned)`
- **Labels:** `design-system`, `foundation`, `no-visual-change`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Extend the design token layer beyond colour
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Story 134 — DS-A: Extend the token layer beyond colour.

Approved directly from the UI/UX reconnaissance performed at commit `2f7aec5`.

THE GAP, AS MEASURED IN THE CURRENT CODE

Colour is the only dimension of this design system that is actually
tokenised. Counted at `2f7aec5` in `packages/config/tailwind-tokens.css`:

  - 55 semantic COLOUR tokens (--ink*, --rule*, --surface*, --accent*,
    --focus, --overlay, plus the four status families). Complete, adopted,
    and guarded.
  - EXACTLY 1 radius value: the CSS custom property --radius
    (tailwind-tokens.css line 136). It is NOT exposed through the Tailwind
    preset as a borderRadius extension, so it is reachable from raw CSS
    but not as a named utility.
  - ZERO spacing tokens. The preset has no `spacing` key at all.
  - ZERO elevation/shadow tokens. The preset has no `boxShadow` key at all;
    elevation is expressed as bare `shadow-sm` utilities.
  - The preset's theme extension has exactly three keys today: `colors`,
    `fontFamily`, `fontSize`.
  - Typography: a named 7-step scale ALREADY EXISTS in
    packages/config/tailwind-preset.js lines 139-147 (caption, label,
    body-sm, body, subhead, heading, title — each with size, line-height,
    and where relevant letter-spacing and weight). It has ZERO usages in
    either app or packages/ui. The preset's own comment says so plainly:
    "Nothing is re-typeset by this file: applying them is a shared
    PageHeader's job (NAV-2)."

    CORRECTION TO THE RECON: the recon reported "no type scale" after
    counting raw text-sm/text-xs usage. That was wrong. The scale is not
    missing, it is unadopted. This story therefore does NOT redefine
    typography — it documents what exists and leaves adoption to a later
    story, exactly as the preset already intends.

So a redesign has no dial to turn for anything except colour. Every
padding, corner, elevation and type-size decision is re-made per file,
which is exactly how the duplication the recon found arose — for example
the literal string "rounded-md border border-rule bg-surface p-4" appears
24 times verbatim, and a textarea class string appears 7 times verbatim
with 2 copies that have already drifted.

WHY THIS STORY IS FIRST, AND WHY IT SHIPS NO VISIBLE CHANGE

Every later design-system story spends this vocabulary. Adopting the
unused Card primitive (recon F1) requires deciding card padding, radius
and elevation; if that decision has no token to live in, the primitive
hard-codes "p-4 rounded-md" and the next redesign re-does all of it.
Defining the vocabulary first is what makes the later stories mechanical.

It is also the lowest-risk bounded unit available: defining tokens changes
no markup, so it cannot touch authentication, permissions, realtime
behaviour, or RTL correctness — it avoids every high-risk area the recon
identified (R1-R6).

This is a PURE VOCABULARY STORY. It adds names for values the codebase
already uses. It does not apply them. Nothing rendered should change.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
TYPE SCALE (verify and document — do NOT redefine)
- [ ] The existing 7-step scale in `tailwind-preset.js` (caption, label,
      body-sm, body, subhead, heading, title) is left UNCHANGED in name,
      size, line-height, letter-spacing and weight.
- [ ] Its steps are documented alongside the other scales so an author can
      find them, and the fact that it is intentionally unadopted (pending
      a later adoption story) is recorded where the next reader will see it.
- [ ] No new competing type scale is introduced.

SPACING SCALE
- [ ] A documented spacing scale is defined, derived from the spacing
      values the codebase already uses in practice (gap-2/3/4, p-4,
      mt-2/3, etc.) rather than invented.
- [ ] Named density decisions exist for the recurring surfaces the recon
      identified — at minimum a card padding value and a stack gap.

RADIUS
- [ ] Semantic radius tokens are defined alongside the existing single
      --radius, covering the corner sizes actually in use.
- [ ] The existing --radius token keeps its current value and meaning.

ELEVATION / SHADOW
- [ ] Semantic elevation tokens are defined for the elevation levels
      already in use (at minimum the shadow-sm used by inputs/cards and
      the overlay elevation used by dialogs/popovers/dropdowns).

INTEGRATION
- [ ] The new tokens are exposed through the EXISTING mechanism —
      `packages/config/tailwind-tokens.css` plus the existing
      `@crm/config` Tailwind preset — not a second, parallel system.
- [ ] Both `apps/web` and `apps/portal` can consume them with no change
      to how either app imports styling today.

NON-REGRESSION (the load-bearing criteria)
- [ ] The 55 existing colour tokens are byte-for-byte unchanged in name,
      value and meaning.
- [ ] NO rendered styling changes. This story adds vocabulary; it does
      not apply it. A visual diff of any screen before/after should be
      empty.
- [ ] No component, page or markup file is migrated to the new tokens in
      this story.
- [ ] Both `design-tokens.spec.ts` guards (web and portal) still pass
      unmodified, and still fail if raw neutral palette is reintroduced.
- [ ] Zero physical-direction classes introduced; the logical-property
      (ms/me/ps/pe/text-start) approach is untouched.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` clean; the full web and
      portal test suites pass unchanged.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** None. Nothing blocks this story, and it
  blocks the rest of the design-system sequence (DS-B Card/Textarea
  adoption, DS-C portal Alert, DS-D list state, DS-E duplicate
  consolidation), each of which needs this vocabulary to spend.
- **Depends on code areas or other stories:**
  - **Story S-1 / DS-1a / DS-1b** — created `packages/config/tailwind-tokens.css`
    and the shared `@crm/config` Tailwind preset, and migrated both apps
    off the raw neutral palette. This story extends that exact file and
    preset; it does not introduce a second mechanism.
  - `packages/config/tailwind-tokens.css` — the 55 colour tokens and the
    single `--radius`, all of which must survive unchanged.
  - `apps/web/src/design-tokens.spec.ts` and
    `apps/portal/src/design-tokens.spec.ts` — the source-scan guards that
    forbid raw neutral palette classes. Must keep passing, unmodified.
  - `packages/ui` — consumes the preset; must keep building.

## Extra notes (optional)

- Approved from the UI/UX recon at `2f7aec5` as **DS-A**, the first of a
  nine-story sequence. Recommended first precisely because it is invisible:
  it cannot regress auth, permissions, realtime or RTL.
- Every number in the Description was measured from the current code, not
  carried over from an earlier audit.
- The honest trade-off, stated up front: this story delivers **no visible
  improvement on its own**. Its value is that it makes DS-B..DS-E
  mechanical instead of a series of fresh per-file judgement calls.
- Derive the scales from what the codebase already uses. Inventing a
  fashionable scale that does not match existing usage would guarantee
  either a visual change here (forbidden) or an unusable vocabulary later.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- The token file already establishes the pattern to follow: CSS custom
  properties on `:root`, surfaced to Tailwind through the shared preset in
  `@crm/config`. Mirror it rather than adding a JS theme object.
- Measured usage to derive the scales from (counted at `2f7aec5`,
  both apps, excluding specs):
  - type: `text-sm` x247, `text-xs` x164, `text-lg` x36, `text-xl` x8,
    `text-2xl` x2
  - the recurring card surface: `"rounded-md border border-rule bg-surface p-4"`
    x24 verbatim
  - the recurring input/textarea surface: `"... rounded-md border
    border-rule-strong bg-surface px-3 py-2 text-sm shadow-sm ..."` x7
    verbatim
- `--radius` is the only existing non-colour token; check how the preset
  currently exposes it before adding siblings, so the new ones are
  reachable the same way.
- Verify "no rendered change" concretely rather than by inspection — for
  example by confirming the built CSS for a representative screen is
  unchanged, or by an explicit before/after check. An assertion of "should
  be identical" is not evidence.

## Out of scope

- What this story explicitly does **not** cover:
  - **Component migration.** No component, page or markup file is changed
    to consume the new tokens. That is DS-B and later.
  - **Any visual redesign** of any existing screen.
  - **Dark mode.** The token file has no `prefers-color-scheme`/`.dark`/
    `data-theme` handling today and gains none here. Dark mode is its own
    later story with a real contrast pass (recon DS-F).
  - **Branding `primaryColor` → `--accent`.** Deliberately deferred by
    `tailwind-tokens.css`'s own comment and re-affirmed by Story 129;
    wiring it would recolour every button from an admin-supplied hex.
  - **Any auth, permission or authorization change.** In particular, the
    codebase has NO client-side permission gating by design — the UI shows
    actions and the API returns 403. Nothing here may alter that.
  - **Any navigation or shell change.** Story 129's `nav-items.tsx`
    single-source-of-truth and the navbar/sidebar shell stay untouched.
  - **Changing the existing 55 colour tokens** in name, value or meaning.
  - **Weakening, editing or deleting either `design-tokens.spec.ts` guard.**
  - **Introducing raw palette values.** New tokens must be semantic; no
    bare hex/rgb sprinkled into components.
  - **Portal or web markup changes**, unless strictly required to wire the
    token infrastructure itself — and if any is required, it must be
    called out explicitly in the plan rather than slipped in.
  - **Adding a charting library, Drawer/Sheet primitive, or consolidating
    cross-app duplicates.** All are separate, later stories in the recon
    sequence.
