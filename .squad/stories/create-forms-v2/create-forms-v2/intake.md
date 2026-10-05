> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/create-forms-v2/create-forms-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Forms and create flows
- **Feature slug (folder under `plans/`):** `create-forms-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-4.4**, global Story **225**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Forms and create flows
```

---

## Description

```
Story 225 — PR-4.4 of the CRM product redesign (roadmap Phase 4).

GOAL
Every create flow reads as one well-built form: grouped sections, labelled
fields with required markers, the reason a submit is disabled, and the
submission error beside the button.

REQUIRED OUTCOME
1. A form-section recipe in @crm/ui: FormSection (fieldset + legend,
   optional guidance, one or two columns) and FormActions (submit, cancel,
   disabled reason tied to the submit, error beside it).
2. The five create pages (ticket, customer, user, SLA policy, article) on
   Card + FormSection + FormField with required markers and a Cancel link.
3. Create ticket: the customer field becomes the searchable Combobox.
4. Same payloads, same validations, same navigation on success.
```

---

## Acceptance criteria

```
- [ ] Sections, required markers (aria-required), Cancel on all five.
- [ ] Disabled submit says what is missing (aria-describedby).
- [ ] Errors show beside the submit; payloads unchanged.
- [ ] en/ar, light/dark, 390/1280; web/ui tests, lint, build, Playwright.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 186 (FormField), 204 (Combobox).
- **Depends on code areas or other stories:** the five create views.

## Extra notes (optional)

- `missingReason` lists missing fields with Intl.ListFormat in the UI language.

## Technical hints (optional)

- Required markers are aria-hidden "*" after the label text.

## Out of scope

- Edit forms (they are inline/Sheet editors elsewhere); new validation rules.
