> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`. User confirmed the
> design direction via an explicit clarifying question before implementation began (see
> `00-overview.md`'s "Why this feature, why now" / "Why this was raised as a question" sections).

# Story intake

## Feature

- **Feature name (display):** Ticket Department-Scoped Visibility (opt-in)
- **Feature slug:** `ticket-department-visibility`

## Description

```text
A fresh Recon after Story 67 confirmed AI Services/Channels/Integrations remain blocked and
every other domain is covered to documented depth, except one real, disclosed gap:
docs/architecture/05-auth-and-security.md names "department visibility" as an intended
fine-grained authorization check that has never been implemented - any ticket:read holder sees
every ticket in the branch regardless of department today. Unlike Stories 64-67, closing this
changes authorization semantics rather than adding an additive surface, so it was raised to the
user as an explicit design question (mirroring this session's own precedent of not
autonomously resolving the SLA Automation "wider action set" design question). The user
confirmed: implement it as an additive, opt-in-per-role capability, current unrestricted
behavior remaining the default for every existing role.
```

## Acceptance criteria

```text
- Role gains ticketVisibilityScope (BRANCH default | DEPARTMENT), settable via the existing
  PATCH /identity/roles/:id (and POST /identity/roles).
- A session whose every held role (for the active branch+department) is DEPARTMENT-scoped sees
  only tickets in their own department plus unassigned (departmentId: null) tickets, across
  GET /tickets and every :id-scoped ticket route.
- A session holding any BRANCH-scoped role keeps full, unchanged branch-wide visibility
  (most-permissive-wins across held roles).
- Role management UI exposes the new field.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and a frontend component test, cover the new surface.
- Every pre-existing test suite remains green, unweakened - especially every existing
  ticket-visibility test, proving the BRANCH default reproduces today's exact behavior.
```

## Dependencies

- **Blocked by / related ids:** none new — extends existing `Role`/`TicketsService`.

## Out of scope

- Reassignment/update restrictions by department, CASL as a library, a branch-switching UI,
  changing any existing role's default scope, any README change.
