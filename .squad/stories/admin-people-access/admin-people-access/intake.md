> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/admin-people-access/admin-people-access/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Admin I: people and access
- **Feature slug (folder under `plans/`):** `admin-people-access`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-4.5**, global Story **226**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Admin I: people and access
```

---

## Description

```
Story 226 — PR-4.5 of the CRM product redesign (roadmap Phase 4).

GOAL
The Users and Roles admin screens read as lists; editing happens in a
focused Sheet instead of a table of inline inputs.

REQUIRED OUTCOME
1. Users: each row reads (email, avatar + name with presence, role and
   department names, active/locked badges, presence) with a named "Edit"
   opening a Sheet that holds today's controls — email, full name, role,
   department, reset password (confirm kept), activate/deactivate
   (confirm kept), unlock. The shared toolbar (same blur search) + count.
2. Roles: "Show permissions" opens a Sheet with the permission catalog
   grouped by resource (ticket, customer, …) as checkbox groups.
3. Same payloads for every mutation.
```

---

## Acceptance criteria

```
- [ ] Users editor Sheet with every control; same payloads.
- [ ] Roles permissions Sheet grouped by resource.
- [ ] en/ar, light/dark, 390/1280; web tests, lint, build, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 211 (Sheet), 225 (FormSection).
- **Depends on code areas or other stories:** `user-list-view.tsx`, `role-list-view.tsx`.

## Extra notes (optional)

- Role name/visibility/activation stay inline in the roles table (short).

## Technical hints (optional)

- The roles Sheet is controlled by the existing expanded state.

## Out of scope

- New permissions, new API fields.
