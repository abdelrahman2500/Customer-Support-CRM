# Story 120 — Ticketing: Managed Category Taxonomy

## Goal

Replace `Ticket.category`/`SlaPolicy.category`/`AutomationRule.conditionCategory`/
`AutomationRule.actionSetCategory`'s free-text strings with a real,
branch-scoped `TicketCategory` foreign key — closing the silent
-fragmentation risk exact-string matching creates across SLA policy
resolution and Automation Rule condition matching today.

## Non-goals

- No category merge/bulk-rename tooling — a single-row rename (already
  sufficient to fix a known typo) is the only correction mechanism this
  story provides.
- No category-grouped report — Reporting currently has zero category
  usage (confirmed directly; the master audit's claim that Reporting
  already depends on this field does not hold up against the code). A
  "ticket volume by category" widget becomes possible once this story
  ships, but is a separate, future Reporting Story.
- No category hierarchy/nesting.
- No department-scoped categories — branch-wide only, mirrors
  `Department`/`QuickReply`.
- No change to Knowledge Base article `category` — a distinct,
  unrelated free-text field (content categorization) on
  `KnowledgeBaseArticle`/`KnowledgeBaseArticleVersion`, never touched.
- No category delete endpoint — mirrors `Department`'s own precedent
  (rename + activate/deactivate only); see the plan overview's own
  Design section for why this is the correct answer to the
  deletion-protection question, not a deferral of it.

## Design

### Schema (`apps/api/prisma/schema.prisma`)

```prisma
model TicketCategory {
  id        String   @id @default(uuid())
  branchId  String   @map("branch_id")
  branch    Branch   @relation(fields: [branchId], references: [id])
  name      String
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tickets          Ticket[]
  slaPolicies      SlaPolicy[]
  conditionOnRules AutomationRule[] @relation("AutomationRuleCondition")
  actionOnRules    AutomationRule[] @relation("AutomationRuleActionSet")

  @@unique([branchId, name])
  @@map("ticket_categories")
  @@schema("ticketing")
}
```

`Ticket.category` → `categoryId String? @map("category_id")` +
`category TicketCategory? @relation(fields: [categoryId], references: [id])`.
`SlaPolicy.category` → `categoryId`/`category` (same shape). `AutomationRule`:
`conditionCategory` → `conditionCategoryId`/`conditionCategory` (relation
name `"AutomationRuleCondition"`), `actionSetCategory` →
`actionSetCategoryId`/`actionSetCategory` (relation name
`"AutomationRuleActionSet"` — two distinct named relations to the same
model are required since both live on `AutomationRule`). `Branch` gains
`ticketCategories TicketCategory[]`.

### Migration — hand-written, zero-loss backfill

One migration, in order: (1) create `ticket_categories`; (2) add the four
new nullable `*_id` columns; (3) `INSERT` one category row per **exact**
distinct `(branch_id, string-value)` pair found across all four legacy
columns (a `UNION` of four `SELECT DISTINCT`s — duplicates across columns
collapse via `UNION`'s own dedup, but two differently-cased strings
never do, by design); (4) `UPDATE` each of the four consuming tables to
set its new `*_id` column via a plain string-equality join back to the
just-created rows; (5) `DROP` the four old string columns only after
every row is confirmed repointed; (6) add the FK constraints
(`ON DELETE SET NULL` — defensive only, never exercised via the API
since there is no delete route) and indexes.

### Backend (`apps/api/src/modules/tickets`)

- New `ticket-categories.service.ts`/`.controller.ts`/`dto/`
  (`create-ticket-category.dto.ts { name }`,
  `update-ticket-category.dto.ts { name?; isActive? }`,
  `list-ticket-categories-query.dto.ts { includeInactive? }`) — mirrors
  `IdentityService`'s `createDepartment`/`updateDepartment`/
  `listDepartments` field-for-field: branch-scoped via
  `TenantContext.requireBranchScope()`, P2002-on-duplicate-name →
  `ConflictException`, no delete route. Registered in the existing
  `TicketsModule`.
- New permission `ticket-category:read`/`:create`/`:update` (seed.ts
  `PERMISSION_CATALOG`; `:read` also added to Agent's default grant,
  mirroring `quick-reply:read`'s identical precedent).
- `TicketsService`: `create`/`update`/`listTickets`/`toTicketSummary`
  swap `category: string` for `categoryId: string` on every DTO-facing
  method; `TicketSummary` gains `categoryId: string | null` +
  `categoryName: string | null` (resolved via
  `include: { category: { select: { name: true } } }`, mapped in
  `toTicketSummary` — mirrors this codebase's own "resolve a display name
  via the existing relation, never denormalize" convention, e.g.
  `AgentPerformanceSummary.fullName`). `resolveSearchAndVisibilityFilter`'s
  `OR` clause changes its `category` arm to `category: { name: { contains:
  search, mode: "insensitive" } }` (a relation filter, same shape,
  same behavior for the caller).
- `SlaTargetListener.resolveBestPolicy`: `ticket.category`/
  `candidate.category` → `categoryId` throughout — the matching *logic*
  (exact equality, `null` = wildcard, most-specific-wins scoring) is
  completely unchanged, only the compared value changes from a string to
  a stable id (which is the whole point — equality on an id can never
  silently fail the way equality on two differently-cased strings can).
- `AutomationEvaluationListener.resolveMatchingRule`: `conditionCategory`
  → `conditionCategoryId`, same treatment.
- `AutomationActionListener`: `event.setCategory`/`ticket.category` →
  `event.setCategoryId`/`ticket.categoryId`; `automation.events.ts`'s
  `AutomationRuleMatchedEvent.setCategory` → `setCategoryId`.
- `WebFormIntakeService`: resolves `dto.category` (still a free string on
  `SubmitWebFormTicketDto` — public, unauthenticated input) to an
  existing `TicketCategory` by exact case-insensitive name within the
  target branch; no match → `categoryId: null` (never auto-creates).
- DTO updates: `create-ticket.dto.ts`/`update-ticket.dto.ts`/
  `list-tickets-query.dto.ts` (`category?: string` → `categoryId?:
  string` with `@IsUUID()`), `create-sla-policy.dto.ts`/
  `update-sla-policy.dto.ts` (same), `create-automation-rule.dto.ts`/
  `update-automation-rule.dto.ts` (`conditionCategory`/`actionSetCategory`
  → `conditionCategoryId`/`actionSetCategoryId`, `@IsUUID()`).
- `SlaPoliciesService`/`AutomationRulesService`: any direct `dto.category`/
  `dto.conditionCategory`/`dto.actionSetCategory` pass-through updated to
  the new id fields; no other logic change.

### Frontend (`apps/web`)

- New `lib/ticket-categories-api.ts` + `hooks/use-ticket-categories.ts`
  (list/create/update) mirroring `branches-api.ts`/`use-branches.ts`'s
  department functions exactly.
- New `components/ticket-categories/ticket-categories-view.tsx` — list +
  inline rename + activate/deactivate + inline "add" form, mirroring
  `BranchDepartmentsView`'s `DepartmentsSection`/`DepartmentRow`/
  `AddDepartmentForm` verbatim. New route
  `app/[locale]/(agent)/ticket-categories/page.tsx` + a new
  `nav.ticketCategories` entry in `WorkspaceNav`, gated by
  `ticket-category:read` the same (client-side-optional,
  server-enforced-regardless) way every other nav item already is.
- `create-ticket-view.tsx`/`ticket-detail-view.tsx`/`ticket-list-view.tsx`:
  free-text category `<Input>` → `<select>` populated from
  `useTicketCategoriesQuery()`; list/detail display switches from
  `ticket.category` to `ticket.categoryName`. `TicketAiCard`'s "apply
  suggestion" action resolves the AI's free-text guess to an existing
  category (case-insensitive exact match) when one exists, else
  pre-fills the create-new-category control with it.
- `automation-rules-view.tsx`/`create-sla-policy-view.tsx`/
  `sla-policy-list-view.tsx`: same free-text-`<Input>`-to-`<select>`
  swap for `conditionCategory`/`actionSetCategory`/`category`.
- `tickets-api.ts`/`automation-rules-api.ts`/`sla-policies-api.ts` type
  updates to match the new id-based fields + resolved display names.
- New `ticketCategories` translation namespace + updated `tickets`/
  `automationRules`/`slaPolicies` keys in both `messages/en.json` and
  `messages/ar.json`.

## Acceptance criteria

- [ ] `TicketCategory` model exists; `Ticket`/`SlaPolicy`/`AutomationRule`
      reference it by id; no free-text category column remains on any of
      the three.
- [ ] Migration backfills every existing distinct category string (per
      branch, across all four legacy columns) into its own
      `TicketCategory` row, with zero data loss and zero silent
      normalization; every existing row is correctly repointed.
- [ ] SLA policy resolution and Automation Rule condition matching use
      id equality; a policy/rule and a ticket sharing the same
      real-world category can never again silently fail to match due to
      casing/whitespace drift.
- [ ] `POST/GET/PATCH` `ticket-categories` (branch-scoped, no delete);
      `ticket-category:read` reachable by the default Agent role,
      `:create`/`:update` SuperAdmin-only.
- [ ] Ticket create/edit/list, SLA policy create/list, and Automation
      Rule create/list all use a category picker, not free text.
- [ ] Web-form intake resolves a submitted category name to an existing
      category or leaves it unset — never creates one from public input.
- [ ] Unit + e2e coverage for the taxonomy CRUD, the migration's
      backfill correctness (spot-checked via a dedicated e2e assertion),
      and every updated call site's id-based behavior.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures (CLAUDE.md §13).

## Verification plan

```
cd apps/api && npx prisma migrate dev --create-only --name add_ticket_category_taxonomy
cd apps/api && npx prisma migrate deploy
pnpm --filter @crm/api exec vitest run src/modules/tickets src/modules/sla-policies
npx vitest run test/tickets.e2e-spec.ts test/sla-policies.e2e-spec.ts test/automation-rules.e2e-spec.ts test/ticket-categories.e2e-spec.ts --no-file-parallelism
pnpm --filter @crm/web exec vitest run src/components/tickets src/components/automation-rules src/components/sla-policies src/components/ticket-categories
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
