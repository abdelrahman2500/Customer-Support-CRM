# branch-creation — plan overview

Entry point for the **branch-creation** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 107 | [107-story-branch-creation.md](./107-story-branch-creation.md) | Identity & Access — Branch creation | — | Stories 03/35/45 (`Branch`/`Organization` schema, read/update endpoints) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 106 closed,
  from the standing, user-approved unblocked backlog. Confirmed still a
  real gap directly against the current repository: `identity.service.ts`'s
  `updateBranch` doc comment explicitly states "there is deliberately no
  `createBranch`; branch creation stays out of scope for this story" (Story
  45), and no `.squad/plans/**`/`.squad/stories/**` entry had previously
  started it.
- **The gap**: every other CRM resource (customers, tickets, KB articles,
  SLA policies, automation rules, notification templates, branding,
  quick replies) is branch-scoped, but the system has no way to create a
  *branch* itself through the product — only `prisma/seed.ts` ever inserts
  one. A multi-branch/multi-department CRM (this project's own stated
  Mission) cannot actually become multi-branch without this.
- **Why not externally blocked**: purely internal — no external
  provider/credential decision is needed, unlike the 8 deliberately-deferred
  Stories (116-123).
- **Dependency correctness**: builds only on already-shipped
  infrastructure — the `Branch`/`Organization` Prisma models (Story 02),
  `listBranches`/`updateBranch` (Stories 35/45), the dynamic
  DB-driven `PermissionsGuard` (Story 03), and `createDepartment`'s
  "never trust the DTO for a tenant-linking id" precedent (Story 45).
- **Architectural coherence**: `organizationId` is resolved from the
  caller's own branch record, never accepted from the client — the same
  trust boundary `createDepartment`/`createUser` already established for
  `branchId`. Reuses `translateDuplicateBranchName` verbatim (its own doc
  comment already anticipated a create path: "within the same
  organization").
- **Product value**: closes a real, load-bearing gap in the foundational
  Identity & Access domain that several other admin features (and the
  Mission's own "multi-branch" framing) implicitly assume is possible.
- **Risk reduction**: narrow, well-isolated CRUD addition following an
  existing, well-tested pattern (`createDepartment`) — low risk relative
  to the other three "High" candidates from the prior inventory (Story
  105's own overview already noted 111/114 as legitimately larger/riskier
  first steps; 107 was deferred behind 105/106 only because 104/105/106
  formed one uninterrupted "extend an existing cap pattern" thread).
- **Non-goal, explicitly deferred**: `listBranches` stays scoped to the
  caller's own single branch (Story 35's existing design, whose own doc
  comment already anticipates this as a *separate* future item: "a future
  branch-switching UI" needing more than one element). This story only
  adds the ability to *create* a branch; a cross-branch listing/switching
  UI for a SuperAdmin to see/manage every branch they've created is left
  for that future story, not silently bundled in here.
