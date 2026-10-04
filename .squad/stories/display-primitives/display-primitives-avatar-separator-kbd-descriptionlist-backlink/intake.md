> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/display-primitives/display-primitives-avatar-separator-kbd-descriptionlist-backlink/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Display primitives: Avatar, Separator, Kbd, DescriptionList, BackLink
- **Feature slug (folder under `plans/`):** `display-primitives`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-1.12**, global Story **189**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-1-design-foundation`, `packages/ui`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Display primitives: Avatar, Separator, Kbd, DescriptionList, BackLink
```

---

## Description

```
Story 189 — RD-1.12 of the CRM UI/UX redesign track (roadmap:
.squad/plans/crm-ui-ux-redesign/00-overview.md §4.2 rows Avatar / Separator /
Kbd / DescriptionList / BackLink and §6 "RD-1.12"; audit:
.squad/plans/crm-ui-ux-redesign/recon.md §2.3 "Missing generic primitives",
§7.4, VL-06).

GOAL
Add five small, domain-free display primitives to @crm/ui that later Stories
need (ticket header, inspector, timeline, user menu, shortcut hints), and
replace the five hand-rolled "back to list" links with the BackLink primitive.

CONTEXT (verified at HEAD 90edc09)
- None of Avatar, Separator, Kbd, DescriptionList or BackLink exists in
  packages/ui/src/components (users render as names only; presence is a Badge
  inside a Select; dividers are hand-rolled borders; key/value pairs are a
  local `Field` helper and a portal <dl> grid).
- Five back links are copy-pasted, each a Next <Link> with
  `<span aria-hidden="true" className="inline-block rtl:rotate-180">&larr;</span>`
  before a translated "back to list" label:
  apps/web/src/components/tickets/ticket-detail-view.tsx (~299–307),
  apps/web/src/components/customers/customer-detail-view.tsx (~545–552),
  apps/web/src/components/knowledge-base/article-detail-view.tsx (~161–168),
  apps/portal/src/components/tickets/ticket-detail-view.tsx (~116–127),
  apps/portal/src/components/knowledge-base/article-detail-view.tsx (~57–68).
  The three web links carry `focus-ring … rounded-sm`; the two portal links
  have NO focus ring (recon A11Y-08).
- Web specs find these links by role + name /detail.backToList/ and assert
  the href (ticket/customer/article detail specs).
- @crm/ui is translation-free and router-free: it cannot import next/link.
  `@radix-ui/react-slot` (Slot, Slottable) is already a dependency
  (Button's `asChild`).
- Icons come from packages/ui/src/lib/icons.ts (ChevronLeftIcon etc.).

REQUIRED OUTCOME
1. Avatar: image or initials; initials derived grapheme-safely (works for
   Arabic and multi-word names); falls back to initials if the image fails;
   sizes sm/md/lg; optional presence ("online" | "offline" | "away") shown as
   a dot AND included in the accessible name via a caller-supplied label (no
   colour-only status); decorative mode (aria-hidden) for when the name is
   already shown next to it.
2. Separator: horizontal/vertical rule on the `rule` token; decorative by
   default, role="separator" + aria-orientation when not decorative.
3. Kbd: a <kbd> on the inner radius and caption type for shortcut hints.
4. DescriptionList: a <dl> with term/description pairs (one or two columns),
   caption-styled terms, body-styled values.
5. BackLink: renders a link-styled control with a direction-aware chevron
   (flips in RTL), token focus ring, muted→ink hover; works with a router
   link via `asChild` (the chevron is injected inside the child).
6. Adopt BackLink at the five sites above; hrefs and labels unchanged; the
   two portal links gain the focus ring.
```

---

## Acceptance criteria

```
- [ ] Avatar, Separator, Kbd, DescriptionList, BackLink exist in packages/ui,
      exported from @crm/ui, each with a spec; token-only styling.
- [ ] Avatar initials: "Ada Lovelace" → "AL", a single name → one letter,
      an Arabic name ("محمد علي") → its first graphemes; broken image → initials.
- [ ] Avatar presence is part of the accessible name (e.g. "Ada Lovelace,
      Online") and visible as a dot; decorative avatars are aria-hidden.
- [ ] Separator decorative by default; role="separator" with orientation
      otherwise.
- [ ] BackLink: chevron aria-hidden and `rtl:rotate-180`; `focus-ring`;
      `asChild` renders the caller's element (e.g. next/link) with the chevron
      inside; accessible name = the label.
- [ ] All five back links use BackLink; hrefs and labels unchanged; the
      existing web specs asserting role/name/href pass; the portal links now
      have a focus ring.
- [ ] @crm/ui stays translation- and router-free; no new dependency.
- [ ] EN/AR, RTL/LTR, light/dark: back links point "back" in both directions;
      no new overflow at 320/768/1280.
- [ ] ui/web/portal tests, typecheck, lint pass; web and portal builds pass.
- [ ] No backend/API/database/auth/routing change.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-1.12 depends on RD-1.2.
- **Depends on code areas or other stories:** Story 179 (tokens: radius, type scale, `cn`), Story 185 (Button `asChild`/Slot precedent), Story 187 (surfaces). Downstream: RD-2.1 (user menu Avatar), RD-3.1/3.3/3.5 (ticket header, inspector DescriptionList, avatars), RD-3.7/3.14 (Kbd).

## Extra notes (optional)

- Avatar adoption in screens is out of scope (later Stories); only BackLink is adopted here.
- Visual evidence with the track's Playwright harness (outside the repo).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- New files: `packages/ui/src/components/{avatar,separator,kbd,description-list,back-link}.tsx` + specs; `packages/ui/src/index.ts`; the five view files above.
- Verification: `pnpm --filter @crm/ui test`, `@crm/web test`, `@crm/portal test`, typecheck/lint for all three, both builds, `git diff --check`.

## Out of scope

- Using Avatar, Separator, Kbd or DescriptionList in any screen; breadcrumbs; any new dependency; backend, API, database, auth, routing or business-rule changes.
