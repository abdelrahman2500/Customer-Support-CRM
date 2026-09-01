> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/sla-automation-rules-category-department/sla-automation-rules-category-department/intake.md`

---

## Feature

- **Feature name (display):** SLA & Automation
- **Feature slug (folder under `plans/`):** `sla-automation-rules-category-department`

## Title

```text
Story 83 — Automation Rules — Category & Department Actions
```

## Description

```text
Story 57 shipped AutomationRule with exactly one action
(actionAssignToUserId) and explicitly deferred a wider action set,
citing an unresolved SLA-desync risk: nothing reacted to an
automation-driven category/department change the way it reacts to a
human PATCH. That reconciliation mechanism (ticket.recategorized ->
SlaTargetListener) already exists (Story 16) and already re-derives the
SLA target from the ticket's current fields regardless of cause. This
story adds two new, independently optional actions (actionSetCategory,
actionSetDepartmentId), each applied only when the matched ticket's own
current value is still null, and emits ticket.recategorized when either
actually changes the ticket - reusing existing machinery, no new
reconciliation code.
```

## Acceptance criteria

```text
- [ ] AutomationRule has actionSetCategory/actionSetDepartmentId via a
      real Prisma migration.
- [ ] Both new actions are validated in-branch at rule create/update
      time (404 for a department outside the caller's branch).
- [ ] AutomationActionListener applies each eligible field only when the
      ticket's own current value is null, and emits
      ticket.recategorized (alongside the existing ticket.updated)
      exactly when category/departmentId actually changed - never when
      only assignedToUserId changed.
- [ ] SlaTargetListener itself is unchanged.
- [ ] Every existing rule (assignment-only) behaves byte-for-byte as
      before this story.
- [ ] priority is not touched anywhere in this story (deferred - see
      the story's own plan for why).
- [ ] The agent-facing automation rules page exposes both new optional
      fields.
- [ ] Backend and frontend tests cover the new behavior.
- [ ] Typecheck, lint, build, and the relevant test suites pass.
```

## Dependencies

- Story 57 — SLA & Automation — Automation Rules Foundation
- Story 16 — Ticket Recategorization and SLA Target Recomputation (the
  reconciliation mechanism this story reuses verbatim)

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- A `priority` automation action (Ticket.priority is non-nullable,
  requires a separate schema decision - deferred).
- Multiple simultaneous matching rules; any change to
  AutomationEvaluationListener's matching/ordering logic.
- Any change to SlaTargetListener itself.
