# RM-05 — Ticket ↔ Knowledge Base Linkage

**Priority:** P1 · **Complexity:** Medium · **Blocked:** No · **Phase:** 1 (Agent Experience)

## Goal

Let an agent search and attach/reference a published Knowledge Base article
directly from the ticket workspace.

## Why it exists

Ticket Management and Knowledge Base are each independently complete and
tested, but confirmed to have zero cross-link anywhere in the codebase — no
`ticketId`/KB-linking field, no KB search widget in
`TicketDetailView`/`TicketListView`/`TicketAiCard`. An agent must leave the
ticket entirely to consult the KB. This is the clearest instance in the
whole codebase of two finished Core Features never being wired together.

## Dependencies

None to ship. Pairs naturally with `RM-00` (AI Suggested Solutions), whose
"reference on ticket" action writes to the same join model this story
introduces — sequence-independent, but implementing them close together
avoids a small amount of duplicated design discussion.

## Backend work

- New `TicketKnowledgeBaseReference` join model: `id`, `ticketId` (FK),
  `articleId` (FK), `referencedByUserId`, `createdAt`.
- `POST /tickets/:id/kb-references` (attach an article — validates the
  article is `PUBLISHED` and in the caller's branch), `GET
  /tickets/:id/kb-references` (list references for a ticket), `DELETE
  /tickets/:id/kb-references/:refId` (remove a reference — gated by
  `ticket:update`).
- Emit a `TICKET_UPDATED_EVENT`-shaped or dedicated
  `ticket.kb-referenced` event so the reference appears in the ticket's
  existing `TicketHistoryEntry` timeline via `TicketHistoryListener`
  (extend its subscribed event list — mirrors how escalation/recategorization
  already flow into history).

## Frontend work

- A KB-search widget inside `TicketDetailView`, reusing the existing
  `KnowledgeBaseService.searchArticles`-backed search endpoint (same
  full-text search the standalone KB screen already uses).
- A "References" section on the ticket showing attached articles with a
  remove action.

## Worker/realtime work

None new — the history-timeline entry rides the existing
`TicketHistoryListener` mechanism.

## Schema/migration work

One new join table (`TicketKnowledgeBaseReference`), one migration.

## Tests

- New `ticket-kb-references.e2e-spec.ts` — attach/list/remove, cross-branch
  rejection (cannot reference an article outside the ticket's branch),
  cannot reference a `DRAFT` article.
- `ticket-detail-view.spec.tsx` — extend for the new search widget and
  References section.

## Acceptance criteria

- An agent can search KB articles without leaving the ticket screen and
  attach one as a reference.
- The reference appears in the ticket's activity history.
- A draft (unpublished) article cannot be referenced.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
