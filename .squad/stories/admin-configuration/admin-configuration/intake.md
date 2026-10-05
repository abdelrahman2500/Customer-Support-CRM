> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/admin-configuration/admin-configuration/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Admin II: configuration
- **Feature slug (folder under `plans/`):** `admin-configuration`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-4.6**, global Story **227**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Admin II: configuration
```

---

## Description

```
Story 227 — PR-4.6 of the CRM product redesign (roadmap Phase 4).

GOAL
The nine configuration screens (SLA policies, branches/departments,
ticket and KB categories, automation rules, quick replies, notification
templates, webhooks, API keys) share one vocabulary.

REQUIRED OUTCOME
1. @crm/ui ActiveBadge (dot + word) for every active/inactive status.
2. The multi-field create forms (automation rules, quick replies,
   webhooks, API keys) open in a dialog from the page header; the one-field
   adds (categories, departments) stay inline; webhooks and API keys keep
   the dialog open to show their one-time secret.
3. The screens that hand-rolled loading / error / empty states (SLA
   policies, automation rules, webhooks, API keys) use QueryStateCard.
4. One h1 per state (already true; verified). Same payloads.
```

---

## Acceptance criteria

```
- [ ] ActiveBadge everywhere; create dialogs; QueryStateCard; same payloads.
- [ ] en/ar, light/dark, 390/1280; web/ui tests, lint, build, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 211, 225.
- **Depends on code areas or other stories:** the nine configuration views.

## Extra notes (optional)

- Notification templates are per-event forms, not a create flow: unchanged.

## Technical hints (optional)

- `CreateDialog` + `useCreateDialogClose()` in `components/admin/create-dialog.tsx`.

## Out of scope

- Edit Sheets for every config row (rows keep their short inline controls).
