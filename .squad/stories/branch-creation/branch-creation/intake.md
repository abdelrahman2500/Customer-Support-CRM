> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/branch-creation/branch-creation/intake.md`

---

## Feature

- **Feature name (display):** Identity & Access — Branch creation
- **Feature slug (folder under `plans/`):** `branch-creation`

## Title

```text
Story 107 — Identity & Access: Branch creation
```

## Description

```text
Every other CRM resource is branch-scoped, but the system has never had a
way to create a Branch itself through the product -- only prisma/seed.ts
ever inserts one. `updateBranch`'s own doc comment has said "there is
deliberately no createBranch" since Story 45. This story adds
POST /identity/branches, gated by a new branch:create permission
(SuperAdmin-only), resolving organizationId from the caller's own branch
(never the client), and reuses the existing translateDuplicateBranchName
P2002 handler.
```

## Acceptance criteria

```text
- [ ] POST /api/v1/identity/branches creates a Branch under the caller's
      own organization; organizationId never accepted from the client.
- [ ] New branch:create permission; SuperAdmin-only, not Agent.
- [ ] Duplicate (organizationId, name) -> 409, exercised end-to-end.
- [ ] 401 unauthenticated; 403 Agent (no branch:create).
- [ ] identity.service.spec.ts unit coverage (organizationId source,
      P2002 -> ConflictException, TenantContext error propagation,
      isActive omission).
- [ ] identity.e2e-spec.ts coverage: 401/403/201/409, plus updating the
      file's own stale "Known scope limit" doc comment.
- [ ] users.controller.ts and identity.service.ts stale doc comments
      updated (no longer claim createBranch doesn't exist).
- [ ] prisma:seed re-run so branch:create exists before e2e verification.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.
```

## Dependencies

- Story 02/03 — `Branch`/`Organization` schema, dynamic DB-driven
  `PermissionsGuard`.
- Story 35 — `listBranches`, `BranchSummary`.
- Story 45 — `updateBranch`, `translateDuplicateBranchName`,
  `createDepartment`'s "never trust the DTO for a tenant-linking id"
  precedent.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Cross-branch `listBranches` / branch-switching UI (future story).
- Auto-assigning the creating admin into the new branch.
- IANA timezone-format validation (mirrors `UpdateBranchDto`'s existing,
  unvalidated plain string).
- Multi-organization support.
