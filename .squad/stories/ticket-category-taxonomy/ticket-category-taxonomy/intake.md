> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/ticket-category-taxonomy/ticket-category-taxonomy/intake.md`

---

## Feature

- **Feature name (display):** Ticketing — Managed Category Taxonomy
- **Feature slug (folder under `plans/`):** `ticket-category-taxonomy`

## Title

```text
Story 120 — Ticketing: Managed Category Taxonomy
```

## Description

```text
Ticket.category is a plain free-text String (schema's own comment: "no
story has justified a Category model yet"), and both SlaPolicy.category
and AutomationRule.conditionCategory/actionSetCategory key off it with
exact string equality. Two differently-cased or -spelled category
strings silently fail to match, degrading SLA policy resolution and
automation-rule condition matching with no error or warning. This story
replaces all four free-text columns with a real, branch-scoped
TicketCategory foreign key (mirroring Department's exact shape: no
delete route, only rename/activate/deactivate), backfills every
existing distinct category string into its own row with zero data loss
or normalization, and updates every consuming service/DTO/UI surface to
use the new id.
```

## Acceptance criteria

```text
- [ ] TicketCategory model exists; Ticket/SlaPolicy/AutomationRule
      reference it by id; no free-text category column remains.
- [ ] Migration backfills every existing distinct category string with
      zero data loss/normalization; every row correctly repointed.
- [ ] SLA policy resolution and Automation Rule condition matching use
      id equality.
- [ ] POST/GET/PATCH ticket-categories (branch-scoped, no delete);
      :read reachable by Agent, :create/:update SuperAdmin-only.
- [ ] Ticket create/edit/list, SLA policy create/list, and Automation
      Rule create/list use a category picker, not free text.
- [ ] Web-form intake resolves a submitted category name or leaves it
      unset -- never creates one from public input.
- [ ] Unit + e2e coverage for the taxonomy CRUD, backfill correctness,
      and every updated call site.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures.
```

## Dependencies

- Story 10-16 — SLA policy foundation + category matching in target
  resolution.
- Story 57/83 — Automation Rule condition/action category fields.
- Story 70 — ticket search/filter (`category` substring match).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Category merge/bulk-rename tooling (single-row rename only).
- A category-grouped report (Reporting has zero current category
  dependency -- a separate, future story).
- Category hierarchy/nesting; department-scoped categories.
- Knowledge Base article `category` (a distinct, unrelated field).
- A category delete endpoint.
