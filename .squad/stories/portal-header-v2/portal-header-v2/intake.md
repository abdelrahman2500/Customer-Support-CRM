> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/portal-header-v2/portal-header-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Portal header v2
- **Feature slug (folder under `plans/`):** `portal-header-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-2.6**, global Story **200**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-2-app-shell`, `apps/portal`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Portal header v2
```

---

## Description

```
Story 200 — RD-2.6 "Portal header v2" of the CRM UI/UX redesign track
(roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md Phase 2 "RD-2.6";
recon PT-03, RS-06, A11Y-11).

GOAL
The customer header mirrors the agent header v2 (Story 195): a brand block
that links home and truncates, an explicit Home nav item, a user menu with
language, theme and sign out, focus rings, and the unread count on the
notifications link's own accessible name.

CONTEXT (verified at HEAD 6bb0aa4)
- apps/portal/src/components/portal/portal-header.tsx: the home link's text
  is "Signed in as {name}" (PT-03: the name doubles as Home, no Home item, no
  truncate/min-w-0, no focus ring); logo uncapped (RS-06); nav items Tickets,
  KB, Chat, Notifications, Account (+ hamburger below sm via DropdownMenu);
  language NativeSelect, ThemeSwitcher and Sign out loose in the header;
  unread Badge carries aria-label on a span (A11Y-11).
- Portal branding has logoUrl/primaryColor/secondaryColor only (no appName);
  common.appName = "Customer Portal".
- Spec portal-header.spec.tsx (401 lines) queries sign-out/language directly
  and the badge by its aria-label; e2e specs don't use header controls.

REQUIRED OUTCOME
1. Row: [hamburger <sm] [brand → /home: logo (max-w-32 below sm) or app
   name, truncating, focus ring] [nav sm+: Home, Tickets, KB, Chat,
   Notifications, Account] … [user menu].
2. User menu = Popover (Avatar + name trigger) with "signed in as",
   language, theme, sign out — behaviours unchanged.
3. Notifications link accessible name carries the count; badge aria-hidden
   (desktop nav and hamburger).
4. No overflow at 320 in en/ar; all destinations unchanged.
```

---

## Acceptance criteria

```
- [ ] No overflow at 320px in en and ar; all nav destinations unchanged plus Home.
- [ ] Brand link truncates and has a focus ring; logo capped below sm.
- [ ] Language, theme and sign out reachable in the user menu; behaviour unchanged.
- [ ] Unread count in the notifications link's accessible name (A11Y-11).
- [ ] Portal header spec updated for intentional moves; portal tests,
      typecheck, lint, build; Playwright customer-submits-ticket green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-2.6 depends on RD-1.5 and RD-1.12.
- **Depends on code areas or other stories:** Story 195 (agent header pattern), Story 189 (Avatar), Story 187 (Popover).

## Extra notes (optional)

- Server-side branding is RD-5.1.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `portal-header.tsx` (+spec), `apps/portal/messages/{en,ar}.json`.

## Out of scope

- Server-side branding, new destinations beyond Home, any backend change.
