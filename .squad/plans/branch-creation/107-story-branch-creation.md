# Story 107 — Identity & Access: Branch creation

## Goal

Add a real `createBranch` capability so a SuperAdmin can create a new
`Branch` through the product, closing the gap `updateBranch`'s own doc
comment has documented since Story 45 ("there is deliberately no
`createBranch`; branch creation stays out of scope for this story").

## Non-goals

- No change to `listBranches` — it stays scoped to the caller's own single
  branch (Story 35's existing design). A cross-branch listing/switching UI
  is a separate, future story (already anticipated by `BranchSummary`'s own
  doc comment).
- No branch-switching UI, no way for an existing user to move between
  branches, no auto-assignment of the creating admin into the new branch.
  A newly created branch starts with zero users/departments — populating it
  (via the already-existing `createUser`, which already accepts an
  arbitrary `dto.branchId`, and `createDepartment` once a user with roles
  in that branch exists) is out of scope for this story.
- No IANA timezone-format validation — `UpdateBranchDto.timezone` has none
  today (plain `@IsString()`); `CreateBranchDto.timezone` mirrors that
  exact same, already-established validation level rather than inventing a
  stricter check only for the new DTO.
- No multi-organization support — this codebase has exactly one real
  `Organization` row by design (`docs/architecture/04-data-and-multitenancy.md`:
  "one explicit row for the CRM company, leaving a future partitioning key
  without pretending this is already multi-tenant SaaS"). `organizationId`
  is resolved from the caller's own branch, not selected by the client.

## Design

- `CreateBranchDto` (new): `name: string` (required), `timezone: string`
  (required), `isActive?: boolean` (optional — the `Branch` schema already
  defaults this to `true`, mirrored by simply omitting the key when
  undefined, exactly like `updateBranch`'s existing spread pattern).
- `IdentityService.createBranch(dto)`:
  - `const { branchId } = this.tenantContext.requireBranchScope();` — every
    authenticated user has an active branch; this is not a "cross-branch"
    permission check itself (that's `branch:create`, below), just how the
    caller's own `organizationId` is resolved.
  - Look up the caller's own branch's `organizationId` via
    `prisma.branch.findFirst({ where: { id: branchId }, select: { organizationId: true } })`
    — mirrors `listBranches`'s own `findFirst`-by-id lookup style in this
    same file. `organizationId` is **never** accepted from the DTO — the
    same trust boundary `createDepartment`/`createUser` already apply to
    `branchId`.
  - `prisma.branch.create({ data: { organizationId, name, timezone,
    ...(isActive !== undefined ? { isActive } : {}) } })`.
  - A `P2002` on `@@unique([organizationId, name])` is translated via the
    **existing** `translateDuplicateBranchName` (unchanged — its doc
    comment already describes "within the same organization", written with
    a future create path already in mind).
- Permission: new `branch:create` key, added to `prisma/seed.ts`'s
  `PERMISSION_CATALOG` only. `ROLE_GRANTS.SuperAdmin` is `PERMISSION_CATALOG`
  itself, so `SuperAdmin` gains it automatically on the next `prisma:seed`
  run; `ROLE_GRANTS.Agent`'s explicit list is left untouched, so `Agent`
  stays excluded automatically — mirrors `user:create`'s own SuperAdmin-only
  precedent for a cross-branch-capable action.
- Route: `POST identity/branches` in `users.controller.ts`, guarded by
  `@RequirePermissions("branch:create")`, placed between the existing
  `GET branches` and `PATCH branches/:id` — the same list/create/update
  ordering `departments`'s own three routes already use in this file.
- Doc-comment upkeep: `users.controller.ts`'s class doc comment
  ("Branch **creation** remains explicitly out of scope") and
  `identity.service.ts`'s `updateBranch` doc comment ("there is
  deliberately no `createBranch`") both need a Story 107 update — they
  actively assert the old, now-false constraint, not just background
  color.
- `identity.e2e-spec.ts`'s own top-of-file doc comment documents a real,
  previously-untestable gap this story closes for free: "this suite cannot
  produce a second, colliding branch to exercise a duplicate BRANCH name
  409 end-to-end... covered by `identity.service.spec.ts`'s mocked-Prisma
  `updateBranch` P2002 test (unit-only)." Once `createBranch` exists, a
  real end-to-end duplicate-name 409 test becomes possible and should
  replace that doc comment's claim, not just add a test alongside a
  now-inaccurate comment.

## Acceptance criteria

- [ ] `POST /api/v1/identity/branches` creates a `Branch` row under the
      caller's own organization, `organizationId` never accepted from the
      client.
- [ ] Gated by a new `branch:create` permission; granted to `SuperAdmin`
      only (via the full-catalog grant), not `Agent`.
- [ ] A duplicate `(organizationId, name)` pair returns `409 Conflict`
      (reusing `translateDuplicateBranchName`), exercised for real
      end-to-end (previously only unit-testable).
- [ ] Unauthenticated request → `401`. Authenticated `Agent`-role request
      (no `branch:create`) → `403`.
- [ ] `identity.service.spec.ts` unit coverage: assigns `organizationId`
      from the caller's own branch (not the DTO); translates `P2002` into
      `ConflictException`; propagates `TenantContext`'s "no active branch"
      error; omits `isActive` from the `create` call when the DTO omits it.
- [ ] `identity.e2e-spec.ts` coverage: 401, 403 (Agent), 201 (admin,
      verified via a direct Prisma read since `listBranches` intentionally
      stays scoped to the caller's own branch), 409 (duplicate name,
      real end-to-end).
- [ ] Stale doc comments updated (`users.controller.ts`,
      `identity.service.ts`'s `updateBranch`, `identity.e2e-spec.ts`'s
      "Known scope limit" paragraph).
- [ ] `pnpm --filter @crm/api prisma:seed` re-run so the new `branch:create`
      permission row exists before e2e verification (mirrors every prior
      story that added a permission key, e.g. Story 100's `notification:read`).
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.

## Verification plan

```
pnpm --filter @crm/api prisma:seed
pnpm --filter @crm/api exec vitest run src/modules/identity/identity.service.spec.ts
npx vitest run test/identity.e2e-spec.ts --no-file-parallelism   # from apps/api, .env sourced
pnpm --filter @crm/api test
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
