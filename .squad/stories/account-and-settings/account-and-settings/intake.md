> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/account-and-settings/account-and-settings/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Notifications, account and settings
- **Feature slug (folder under `plans/`):** `account-and-settings`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-4.3**, global Story **224**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Notifications, account and settings
```

---

## Description

```
Story 224 — PR-4.3 of the CRM product redesign (roadmap Phase 4; merges
RD-4.8 notifications inbox and RD-6.5 settings deep links).

REQUIRED OUTCOME
1. Notifications: history first, preferences after it; the event as text
   (not an outline badge); the ticket link kept; one scroll box (RS-08);
   the fetching indicator in the page header (already there).
2. One "Account" area at /my-sessions: profile facts (avatar, name, email,
   roles), sessions (hosted under the page's h1, readable device names,
   calmer Sign out) and change password. Nav item "My Account".
3. Settings tabs mirror ?tab= (deep links, reload-safe); business-hours
   day names use a minimum instead of a fixed width.
Same data, pagination and mutations throughout.
```

---

## Acceptance criteria

```
- [ ] History first; preferences mutations unchanged.
- [ ] Account: one h1, profile + sessions + password.
- [ ] /settings?tab=businessHours opens that tab; switching writes ?tab=.
- [ ] en/ar, light/dark, 390/1280; web tests, lint, build, Playwright green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 198 (hosted views).
- **Depends on code areas or other stories:** notifications, settings, sessions views.

## Extra notes (optional)

- A read/unread backend is out of scope.

## Technical hints (optional)

- `MySessionsView hosted` follows the established `headingLevel` pattern.

## Out of scope

- Moving /branding etc. into the nav; read/unread state.
