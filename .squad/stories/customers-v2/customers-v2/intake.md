> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customers-v2/customers-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customers v2
- **Feature slug (folder under `plans/`):** `customers-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-4.1**, global Story **222**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Customers v2
```

---

## Description

```
Story 222 — PR-4.1 of the CRM product redesign (roadmap Phase 4; merges
RD-4.4 customer list v2 and RD-4.5 customer detail v2).

GOAL
Customers read like the rest of the v2 product: a standard list toolbar
and avatar rows; a detail page with an entity header, calmer contact rows
and editors in dialogs, and the customer's tickets one link from the board.

REQUIRED OUTCOME
1. List: ListToolbar (search, status FilterSelect, result count, clear
   all), avatar beside each name; same URL parameters and request.
2. Detail: avatar in the entity header; status change confirmed first;
   "Add contact" in a dialog (RS-07); the portal password set from a
   per-contact dialog (its confirm step kept); related tickets as wrapping
   mini cards (RS-05) with "View these tickets on the board" (board gains
   a customerId filter, shown as a removable chip); EmptyState for empty
   sections. Every mutation keeps its payload.
```

---

## Acceptance criteria

```
- [ ] List filters, sort and pagination behave as before.
- [ ] Rename, status, add contact, portal password, revoke: same payloads.
- [ ] Board link filters to the customer; en/ar, light/dark, 390/1280 clean.
- [ ] web tests, typecheck, lint, build and Playwright green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 211 (ListToolbar), 216 (board filters).
- **Depends on code areas or other stories:** `customer-list-view.tsx`, `customer-detail-view.tsx`.

## Extra notes (optional)

- Customer KPIs need API fields and stay out.

## Technical hints (optional)

- Dialog/ConfirmDialog nesting for the portal password.

## Out of scope

- New columns needing API fields; customer KPIs.
