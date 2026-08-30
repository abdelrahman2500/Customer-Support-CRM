# Feature overview — Ticket Department-Scoped Visibility (opt-in)

## Why this feature, why now

`docs/architecture/05-auth-and-security.md` names an intended, disclosed
capability that has never been implemented: *"CASL handles fine-grained
checks such as assignment and department visibility."* Today,
`TicketsService.listTickets`/`getTicket`/every ticket sub-resource scopes
only by `branchId` — any user holding `ticket:read` sees every ticket in
the branch regardless of department, and `ticket:update` can reassign to
any department/user in the branch. This is a real, concretely-disclosed
gap, unlike an invented one.

## Why this was raised as a question, not silently implemented

Unlike every other Story this session (64–67), closing this gap means
changing *authorization semantics* — who can see which tickets — not
adding a new, additive read/write surface. That carries real product and
security consequences and has more than one defensible design (should
narrower visibility be the new default? does it also restrict
reassignment? what happens to a ticket with no department?). This mirrors
this session's own established precedent for the SLA Automation "wider
action set" gap: a real, disclosed capability that was *not* autonomously
implemented because its design was genuinely open. The user was asked;
they confirmed: **implement it as an additive, opt-in capability with the
current, unrestricted behavior remaining the default for every existing
role** — recommended because it closes the documented gap with zero
regression risk to any current role/test/deployment.

## Scope

- `Role` gains `ticketVisibilityScope: "BRANCH" | "DEPARTMENT"`, defaulting
  to `"BRANCH"` — every existing role (seeded or previously created) keeps
  today's exact branch-wide visibility with no migration data change
  needed beyond the new column's own default.
- An admin opts a role into `"DEPARTMENT"` via the existing Role
  management screen (`PATCH /identity/roles/:id`, no new route).
- `TicketsService` additionally filters by department **only when every
  role the caller holds for their active branch+department session is
  `"DEPARTMENT"`-scoped** (most-permissive-wins across held roles, mirroring
  how this codebase already unions permissions across roles rather than
  intersecting them) — a session holding even one `"BRANCH"`-scoped role
  keeps full branch visibility.
- A department-scoped viewer sees tickets in their own department **plus**
  tickets with no department set (`departmentId: null`) — an unassigned
  ticket is never hidden from everyone, which would effectively orphan it.
- Read-only for this foundation: **list/get visibility only.** Reassignment
  restrictions (the "assignment" half of the same doc sentence) are a
  separate, deferred concern — narrower in one dimension keeps this Story
  reviewable and its regression surface small.

**Not in scope**: reassignment/update restrictions by department; CASL as
a library (the outcome the doc names — fine-grained visibility — is
achieved with a plain Prisma filter, mirroring this codebase's consistent
preference for the simplest mechanism that satisfies the documented
requirement, e.g. Reporting's "direct queries, not materialized views");
a branch-switching UI (still explicitly out of scope per `identity.service
.ts`'s own `issueAccessToken` doc comment); retroactively changing any
existing role's default.

## Dependencies

None new — extends `Role` (already exists) and `TicketsService` (already
exists). No schema owned by another domain changes.
