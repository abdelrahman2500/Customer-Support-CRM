# ticket-category-taxonomy — plan overview

Entry point for the **ticket-category-taxonomy** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 120 | [120-story-ticket-category-taxonomy.md](./120-story-ticket-category-taxonomy.md) | Ticketing — Managed Category Taxonomy | — | Story 10-16 (SLA policy category matching), Story 57/83 (Automation Rule category condition/actions), Story 70 (ticket search/filter) |

## Dependency notes

- Selected per the user's explicit, direct instruction after reviewing a
  full master-backlog audit: "Ticket Category Taxonomy" ranked #1 by
  CLAUDE.md §2's dependency-correctness criterion — it is the only
  identified gap whose cost compounds while unaddressed (more production
  data accumulating under an unconstrained, silently-fragmentable free
  -text field the longer it stays free-text).
- **The gap, confirmed directly**: `apps/api/prisma/schema.prisma`'s own
  comment on `Ticket.category` states it plainly: *"a plain nullable
  String, not a lookup table — no story has justified a `Category` model
  yet."* Three domains key off this exact string value with **exact
  equality matching**, confirmed by reading the actual resolution code:
  - `SlaTargetListener.resolveBestPolicy` (`sla-target.listener.ts`):
    `{ category: null } OR { category: ticket.category }` — a ticket
    tagged `"Billing"` will never match an `SlaPolicy` tagged
    `"billing"`, silently falling back to a less-specific (or no) policy.
  - `AutomationEvaluationListener.resolveMatchingRule`
    (`automation-evaluation.listener.ts`): identical exact-match shape
    against `AutomationRule.conditionCategory`.
  - `AutomationActionListener` writes `actionSetCategory` (another free
    string) directly onto `Ticket.category` when a rule fires — a third,
    independent source of untracked category strings.
  - **Correction to the master audit's own claim**: a direct grep of
    `apps/api/src/modules/reporting/reporting.service.ts` found **zero**
    actual `category` usage — Reporting does not currently group by or
    filter on ticket category at all (the audit's "Reporting/group-by
    behavior" dependency claim does not hold up against the actual code;
    a category-grouped report becomes possible *after* this story, but
    is explicitly out of scope for it — see Non-goals).
- **Why not externally blocked**: purely internal Ticketing/SLA/
  Automation schema work — no external provider/credential decision
  needed.
- **Design decisions this story makes**:
  - **A real foreign key, not an advisory list.** A "soft" vocabulary
    (suggestions only, field stays free-text) would not actually close
    the gap — any typo would still silently be accepted. `TicketCategory`
    (branch-scoped, mirrors `Department`'s exact shape: `id`, `branchId`,
    `name`, `isActive`, `@@unique([branchId, name])`) becomes the single
    source of truth; `Ticket.categoryId`, `SlaPolicy.categoryId`,
    `AutomationRule.conditionCategoryId`/`actionSetCategoryId` replace
    the four existing free-text columns outright.
  - **No delete endpoint — mirrors `Department`'s own precedent exactly**
    (that model has never had a delete route, only rename +
    activate/deactivate). This is what actually answers the "does
    category deletion need protection when referenced" question: there
    is no deletion to protect against. An inactive category remains
    valid on every historical ticket/policy/rule that already references
    it forever; it simply stops appearing in "assign a new ticket"-style
    pickers going forward (the same `includeInactive` pattern
    `listBranches`/`listDepartments`/`listRoles` already use).
  - **Zero-loss, zero-guesswork data migration.** One `TicketCategory`
    row is created per **exact, distinct** string value found across all
    four legacy columns, per branch — `"Billing"` and `"billing"` become
    two separate rows if that is what the data actually contained, never
    silently merged or renamed. Nothing is normalized, deduplicated, or
    destroyed; every existing ticket/policy/rule is repointed at its own
    matching new row via a plain string-equality join, then (only then)
    the old columns are dropped. An admin can rename a category later
    (e.g. to fix a known typo) through the new management screen, but
    that is a deliberate, visible, later action — not something this
    migration ever does on its own judgment.
  - **Public web-form intake stays free-text on the wire, resolved
    server-side.** `SubmitWebFormTicketDto.category` is public,
    unauthenticated input — it cannot be trusted to name a real category
    ID. It is resolved to an existing `TicketCategory` by exact,
    case-insensitive name match within the target branch; no match
    leaves the ticket's category unset, and no new category is ever
    auto-created from public input (that would silently reopen exactly
    the fragmentation risk this story exists to close).
  - **AI-suggested category stays advisory, resolved by the agent.**
    `TicketAiService.categorizeTicket` already only ever returns a
    suggestion — nothing writes it directly. The "apply suggestion" UI
    action now resolves the suggested text to an existing category by
    exact case-insensitive name (one click, unchanged UX) when one
    exists, or pre-fills the "create new category" control with the
    suggested name (one extra confirm click) when it doesn't — never a
    silent, unvalidated write.
  - **Permission**: new `ticket-category:read`/`:create`/`:update`,
    mirroring `quick-reply:*`'s exact precedent — `:read` added to
    Agent's default grant (agents need it to select a category day to
    day), `:create`/`:update` stay SuperAdmin-only via the full catalog.
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for
  the full list): no category merge/bulk-rename tooling beyond a plain
  single-row rename; no category-grouped report (a real, separate,
  future Reporting story now that the join-key actually exists); no
  nesting/hierarchy of categories; no department-scoped categories (a
  category is branch-wide, mirroring `Department`/`QuickReply`, not
  nested under a department); Knowledge Base article `category`
  (`KnowledgeBaseArticle`/`KnowledgeBaseArticleVersion`) is a completely
  separate, unrelated free-text field (content categorization, not
  ticket routing) and is explicitly untouched by this story.
