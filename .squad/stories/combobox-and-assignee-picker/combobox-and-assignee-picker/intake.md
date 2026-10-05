> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/combobox-and-assignee-picker/combobox-and-assignee-picker/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Combobox primitive and assignee picker
- **Feature slug (folder under `plans/`):** `combobox-and-assignee-picker`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.4**, global Story **204**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `packages/ui`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Combobox primitive and assignee picker
```

---

## Description

```
Story 204 — RD-3.4 "Combobox primitive and assignee UserPicker" of the CRM
UI/UX redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md
Phase 3 "RD-3.4"; recon TW-08 (no search in the user list; presence only
inside the dropdown; cannot unassign)).

GOAL
A searchable, keyboard-first Combobox in @crm/ui, used for the ticket's
assignee: type to filter, arrow keys, presence as text, the agent's own
entry first and marked, the same PATCH as today.

CONTEXT (verified at HEAD f7c4f34)
- Inspector Properties: the assignee is a Radix Select (Field label
  "detail.assignedAgent", trigger aria-label the same), options = users with
  an online/offline Badge (useAgentPresence), onValueChange →
  updateAssignee(id) (Story 202's shared handler: PATCH {assignedToUserId}
  + toast). Disabled while the mutation is pending or users load.
- Unassign recon (roadmap-required): UpdateTicketDto has
  assignedToUserId?: string with @IsOptional() @IsUUID(); the service calls
  requireUserInScope(dto.assignedToUserId) whenever it is !== undefined, so
  null would fail the scope lookup → **the PATCH does not cleanly accept
  null; "Unassigned"/clear is dropped** (no backend change).
- Specs open the picker via getByRole("combobox", {name:
  "detail.assignedAgent"}) and find options via getByRole("option", {name:
  /Jane Online/}) with presence text inside.
- No combobox/command dependency is installed; Radix Popover is.
- Shared look: lib/control.ts controlClassName; lib/menu.ts menu classes.

REQUIRED OUTCOME
1. packages/ui Combobox: trigger button role=combobox (aria-expanded,
   aria-controls, aria-haspopup=listbox, name via aria-label), Radix Popover
   panel with a search input (aria-activedescendant, aria-controls,
   aria-autocomplete=list) and a role=listbox of role=option items
   (aria-selected); ArrowUp/Down, Home/End, Enter, Escape (focus back to
   trigger), filtering as type-ahead; leading slot + description per option;
   empty text; disabled; RTL by logical classes + Radix dir.
2. Assignee picker in the inspector built on it: Avatar + name + presence
   text ("Online"/"Offline") per option, the current agent first and marked
   "(you)", same updateAssignee payload.
3. Unassign not offered (recon result recorded).
```

---

## Acceptance criteria

```
- [ ] Keyboard-only assignment works (open, filter, arrows, Enter).
- [ ] Presence is announced as text in each option's name.
- [ ] The PATCH payload is identical to today (spec).
- [ ] Combobox spec: ARIA roles/attributes, keys, filtering, empty, Escape focus.
- [ ] Existing assignee presence specs pass unchanged; Playwright green.
- [ ] 320/768/1280 × en/ar × light/dark: 0 overflow; panel inside viewport.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.4 depends on RD-3.3.
- **Depends on code areas or other stories:** Stories 187 (Popover), 189 (Avatar), 202 (updateAssignee), 203 (inspector).

## Extra notes (optional)

- Team scoping and server-side user search are out of scope.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/combobox.tsx` (+spec, index), `ticket-detail-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`.

## Out of scope

- Unassign (PATCH does not accept null), team scoping, server-side search, replacing the other Selects, any backend change.
