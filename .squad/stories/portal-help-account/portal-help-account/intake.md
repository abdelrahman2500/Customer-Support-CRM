> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/portal-help-account/portal-help-account/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Portal help and account
- **Feature slug (folder under `plans/`):** `portal-help-account`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-5.3**, global Story **231**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Portal help and account
```

---

## Description

```
Story 231 — PR-5.3 of the CRM product redesign (roadmap Phase 5).

GOAL
The portal's self-service screens (help articles, the assistant,
notifications, account) read as one calm help centre.

REQUIRED OUTCOME
1. Knowledge base: a page header, one prominent search, article cards with
   an excerpt, and "Still need help?" (assistant or a new ticket) under the
   list and under every article; articles in a reading layout.
2. Assistant: the page gets its missing h1; a full-height conversation on
   the shared MessageThread/MessageBubble/Composer; "Thinking…" announced
   through a polite role="status"; escalating to a person (which opens a
   ticket) is confirmed first.
3. Notifications: history first, preferences after it, each preference a
   Switch named by its event.
4. Account on the reading width.
```

---

## Acceptance criteria

```
- [ ] KB cards + reading layout + Still need help; assistant h1, full height, status, confirm; Switch preferences.
- [ ] Same API requests.
- [ ] en/ar, light/dark, 390/1280; portal/ui tests, lint, build, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 205, 207, 211, 229, 230.
- **Depends on code areas or other stories:** `apps/portal/src/components/{knowledge-base,chat,portal}/**`, `@crm/ui` `MessageThread`.

## Extra notes (optional)

- `MessageThread` gains `fill` (fill a flex parent) for the full-height assistant.

## Technical hints (optional)

- `ConfirmDialog`, `Switch`, `Composer` from `@crm/ui`.

## Out of scope

- Profile editing (no portal endpoint).
