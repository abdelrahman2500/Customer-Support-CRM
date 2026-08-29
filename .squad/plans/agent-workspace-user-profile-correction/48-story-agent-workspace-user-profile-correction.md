# Story 48 — Agent Workspace: User Profile Correction — Email Change & Admin-Driven Password Reset

## Prerequisites

- `project-foundation` Story 02/03/04: `User`/`RefreshToken` Prisma models, the existing `hashPassword` helper (bcryptjs, cost 12), and the bcrypt-based `login`/`refresh` flow.
- `agent-workspace-session-refresh` Story 41: `revoke()` (the real name of the "logout" service method) and its single-token revocation shape, directly extended here.
- `agent-workspace-user-admin` Story 32/38: `UserListView`/`UserRow`, `CreateUserView`'s password-field precedent (`type="password"`, `minLength={8}`, no complexity rule).
- `agent-workspace-role-permission-management` Story 46: the precedent of splitting a materially more sensitive action into its own permission key.
- `agent-workspace-user-role-assignment` Story 47: the row-level immediate-commit mutation pattern and its 3-way (403/verbatim-ApiError/generic) error-handling convention, both reused here.

---

## Story Goal

Let an admin correct an existing user's **email address** (reusing the existing `user:update` permission) and set a **new password** for them directly (a new, dedicated `user:reset-password` permission) — both from the existing `/users` screen, no new route or screen. This closes the last remaining "fixed forever at creation" gap for a `User` record; `fullName`/`isActive` (Story 32) and `roleId`/`departmentId` (Story 47) are already correctable.

**Not in scope**: any self-service "forgot password" flow requiring email delivery; any password-complexity rule beyond the existing `MinLength(8)`; a confirm-password field or show/hide toggle; revoking access tokens before their natural expiry (not possible without a new blocklist mechanism this story does not build); any change to Role/Department/Branch assignment (Story 47, untouched).

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `User.email` (`String @unique`, already unique — no new constraint needed) and `RefreshToken` (`revokedAt DateTime?`, `tokenHash String @unique`) — both already exist, reused as-is.
2. `apps/api/src/modules/identity/identity.service.ts` — `login`/`refresh`/`revoke` (the exact evidence behind the password-reset token-revocation decision — `refresh()` never reads `passwordHash`, and `revoke()` only ever revokes the one presented token, never all of a user's tokens); `createUser`'s `hashPassword(dto.password)` call and its email pre-check (the one exception to this file's P2002-catch convention); `updateUser` (the exact conditional-spread pattern this story's email field extends); Story 45/46/47's `translateDuplicate<X>Name` functions (the exact pattern `translateDuplicateEmail` mirrors).
3. `apps/api/src/modules/identity/dto/create-user.dto.ts` — the sole existing password-validation precedent (`@IsString() @MinLength(8)`), mirrored exactly for the new `ResetPasswordDto`.
4. `apps/web/src/components/users/user-list-view.tsx` — the screen this story extends: `UserRow`'s existing blur-commit `fullName` `Input`, and Story 47's `assignmentMutation`'s 3-way error-rendering block (the exact pattern the new password-reset control mirrors).
5. `apps/web/src/components/users/create-user-view.tsx` — the only existing password-input precedent (`type="password"`, `minLength={8}`, no toggle, no confirm field).
6. Confirmed via a full glob/grep of `apps/web/src`: no dialog/modal/popover component exists anywhere in this codebase — this story does not introduce one.

---

## Design decisions

### 1. Password reset and existing refresh tokens — resolved: revoke all

`refresh()` (`identity.service.ts:139-163`) checks only `record.revokedAt`, `record.expiresAt`, and `user.isActive` — it never reads `user.passwordHash`, and no field anywhere links a `RefreshToken` to a password version. `revoke()` (Story 41's logout, `identity.service.ts:165-172`) revokes exactly the one token being logged out with (`where: { tokenHash, revokedAt: null }`), never all of a user's tokens — and no "revoke all tokens for a user" method exists anywhere in the codebase today. Deactivating a user (`updateUser({ isActive: false })`) deliberately does *not* revoke tokens either, relying entirely on `refresh()`'s `isActive` check at the next attempt (proven by `identity.service.spec.ts`'s existing test asserting `updateUser` makes no `refreshToken` call) — sufficient there because `isActive` stays permanently false afterward.

A password reset is different in kind: its entire purpose is to invalidate a possibly-compromised credential. Because `refresh()` never checks the password hash, a stolen-but-still-valid refresh token would survive a password reset completely undetected, defeating the reset's security purpose. **Decision: `resetPassword` must revoke every currently-unrevoked `RefreshToken` row for that user**, via a new helper:
```ts
private async revokeAllRefreshTokens(userId: string): Promise<void> {
  await this.prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```
mirroring `revoke()`'s exact shape, scoped by `userId` instead of a single `tokenHash`.

**Disclosed, not fixed**: an already-issued, still-valid access token (JWT) cannot be revoked before its own (short) natural expiry — this codebase has no access-token blocklist anywhere, the same pre-existing, accepted limitation already disclosed for Role changes (Story 46) and user reassignment (Story 47). Not addressed here.

### 2. Permission model

- **Email change reuses `user:update`** — a plain profile-field edit, the same risk class as `fullName`/`isActive`, already gated by that key.
- **Password reset gets a new, dedicated key: `user:reset-password`** — applying the exact "materially more sensitive than a plain update" test Story 46/47 already established, a password reset is arguably higher-stakes than a role reassignment (it needs no cooperation from the target user's own credentials at all). Added to `PERMISSION_CATALOG`; `ROLE_GRANTS` needs zero manual edit (`SuperAdmin: PERMISSION_CATALOG` covers it automatically); `Agent` unchanged (`[]`).

### 3. Email uniqueness/conflict — resolved: P2002-catch, 409

`createUser`'s pre-check (`findUnique` then `ConflictException`) is the one exception to this file's P2002-catch convention, justified only because it's the sole *insert* site for `User`. Email **change** is structurally an *update*, matching the shape of every mutation since Story 45. **Decision: mirror the P2002-catch convention** with a new `translateDuplicateEmail`, identical in shape to `translateDuplicateBranchName`:
```ts
function translateDuplicateEmail(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
    return new ConflictException("A user with this email already exists");
  }
  return error as Error;
}
```
This is race-free (no separate check-then-write gap) and consistent with the more recent, more-established pattern rather than `createUser`'s older one. HTTP status: **409**.

### 4. Password validation/hash requirements — resolved: mirror creation exactly

`ResetPasswordDto.newPassword` gets `@IsString() @MinLength(8)` — the sole existing precedent, unchanged. No uppercase/number/symbol rule is introduced (none exists anywhere in this codebase; inventing one now would be a product decision beyond "profile correction" scope). Hashing reuses the existing exported `hashPassword()` helper verbatim (bcryptjs, cost factor 12) — no new hashing logic.

### 5. Inactive users — resolved: no restriction

No existing check anywhere in `updateUser` gates on `existing.isActive` before allowing a mutation — `fullName`, `isActive` itself, `roleId`, `departmentId` are all freely editable on an inactive user today. Email change and password reset follow the identical, already-established precedent: permitted regardless of the user's current active state.

### 6. UI shape — resolved: inline, no dialog

A full glob of `apps/web/src/components/ui/` (`button`, `badge`, `input`, `select`, `skeleton`, `table`, `alert` — no `dialog`/`modal`/`popover`) and a repo-wide grep confirm **zero** modal primitive exists anywhere in this codebase. Every Story 45–47 mutation — including reassigning a `SuperAdmin` or deactivating a branch — commits inline with no confirmation step. This story follows the same convention rather than introducing the codebase's first modal purely for this one action:
- **Email**: the existing plain-text email `TableCell` becomes a blur-commit `Input`, identical in shape to the existing `fullName` field, reusing the **same, now-widened** `useUpdateUserMutation(user.id)` and its existing 2-way (403/generic) error pattern.
- **Password reset**: a `type="password"` `Input` (mirroring `CreateUserView`'s exact field: `minLength={8}`, no toggle, no confirm field — neither has any precedent anywhere in this codebase and both are explicitly deferred, not silently added) plus an explicit "Reset password" `Button`, disabled until the value is ≥8 characters. Commits on **click**, not blur (a blank/partial value must never silently commit) — via a new `useResetPasswordMutation(user.id)`, clearing the field on success, and reusing Story 47's exact 3-way error pattern (403 → forbidden copy; other `ApiError` → verbatim message, covering the eventual duplicate-email-adjacent cases and any validation error; else → generic fallback).
- Both controls live in the existing email `TableCell` (grouped as "account identity" fields) — no new table column is added.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/seed.ts`** — add `"user:reset-password"` to `PERMISSION_CATALOG` (grouped with the existing `user:*` keys, after `user:reassign`); no `ROLE_GRANTS` edit needed.
2. **`apps/api/src/modules/identity/dto/update-user.dto.ts`** — add `email?: string` (`@ApiProperty({ required: false })`, `@IsOptional()`, `@IsEmail()`).
3. **`apps/api/src/modules/identity/dto/reset-password.dto.ts`** (new) — `ResetPasswordDto { newPassword: string }` (`@ApiProperty()`, `@IsString()`, `@MinLength(8)`).
4. **`apps/api/src/modules/identity/identity.service.ts`**:
   - `updateUser(id, dto)`: extend the conditional-spread `data` object with `...(dto.email !== undefined ? { email: dto.email } : {})`; wrap the `prisma.user.update(...)` call in try/catch, P2002 → new `translateDuplicateEmail`.
   - New `resetPassword(id: string, dto: ResetPasswordDto): Promise<{ id: string }>`: `const existing = await this.prisma.user.findUnique({ where: { id } }); if (!existing) throw new NotFoundException("User not found");` → `const passwordHash = await hashPassword(dto.newPassword);` → `await this.prisma.user.update({ where: { id }, data: { passwordHash } });` → `await this.revokeAllRefreshTokens(id);` → `return { id };`.
   - New private `revokeAllRefreshTokens(userId)` (Design item 1).
   - New module-level `translateDuplicateEmail` function (Design item 3).
5. **`apps/api/src/modules/identity/users.controller.ts`** — new `PATCH users/:id/password` (`@RequirePermissions("user:reset-password")`), body `ResetPasswordDto`, calls `this.identityService.resetPassword(id, dto)`, returns `{ id }`. Update the class doc comment to record this addition (mirroring the existing per-story comment style).
6. **Tests** — see Test Plan.

### Frontend

7. **`apps/web/src/lib/tickets-api.ts`** — `UpdateUserInput` gains `email?: string` (additive, reuses the existing `updateUser()` function/endpoint unchanged); new `ResetPasswordInput { newPassword: string }` and `resetPassword(id, input): Promise<{ id: string }>` → `PATCH /identity/users/:id/password`.
8. **`apps/web/src/hooks/use-tickets.ts`** — new `useResetPasswordMutation(id: string)`, never-optimistic, invalidates `["users"]` on success (consistent with every other mutation hook, even though no field in `UserSummary` reflects the password).
9. **`apps/web/src/components/users/user-list-view.tsx`** — `UserRow`'s email `TableCell` becomes a blur-commit `Input` (reusing the existing `mutation` = `useUpdateUserMutation(user.id)`, now sending `{ email }`); below it, a password-reset `Input` (local `useState` draft, cleared on success) + `Button` wired to a new `useResetPasswordMutation(user.id)`, disabled until the draft is ≥8 characters, with the 3-way error block mirroring the assignment mutation's exact JSX shape.
10. **i18n** — extend the existing `users.list` namespace (additive) in both `en.json`/`ar.json`: `emailLoadError`? (not needed — email has no separate query), and specifically: reuse `columns.email` (already exists) as the label; add `passwordResetLabel`, `passwordResetPlaceholder`, `passwordResetSubmit`, `passwordResetSubmitting`, `passwordResetSuccess` (a brief inline confirmation after a successful reset, since there's no other visible change to confirm it worked), and reuse the existing `actionForbidden`/`actionFailed` keys for the shared error copy.
11. **Tests** — `user-list-view.spec.tsx` (modified, see Test Plan).

---

## API contract

`PATCH /identity/users/:id` — unchanged route/permission (`user:update`) — body additionally accepts `email?: string` — 409 on duplicate email (new).
`PATCH /identity/users/:id/password` (new) — `@RequirePermissions("user:reset-password")` — body `{ newPassword: string }` — returns `{ id }` — 401/403 per usual; 404 unknown user; revokes all of the user's refresh tokens on success.

## DTO definitions

```ts
// update-user.dto.ts (extended)
export class UpdateUserDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() fullName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
}

// reset-password.dto.ts (new)
export class ResetPasswordDto {
  @ApiProperty() @IsString() @MinLength(8) newPassword!: string;
}
```

## Validation/scoping rules

No branch/tenant scoping on either mutation (identical to `updateUser` today — this module's user mutations are not branch-scoped the way Branch/Department mutations are; only `updateUserAssignment`, Story 47, introduced own-branch scoping, and that remains unchanged here). No restriction based on `isActive` (Design item 5).

## Error behavior

| Condition | Status | Message |
|---|---|---|
| No token | 401 | — |
| Missing `user:update` (email change) / `user:reset-password` (password reset) | 403 | "Missing required permission" |
| Unknown user id | 404 | "User not found" |
| Duplicate email | 409 | "A user with this email already exists" |
| Password shorter than 8 characters | 400 (validation pipe) | class-validator's standard message |

## UI behavior

Email cell: blur-commit, revert-on-error, identical shape to `fullName`. Password-reset control: explicit click-to-commit, disabled until ≥8 characters, clears on success, shows a brief success confirmation (no other visible signal that a password change occurred), 3-way error split for failures.

## i18n

Additive-only keys under the existing `users.list` namespace in both `en.json`/`ar.json`: `passwordResetLabel`, `passwordResetPlaceholder`, `passwordResetSubmit`, `passwordResetSubmitting`, `passwordResetSuccess`. No existing key renamed, removed, or restructured. `actionForbidden`/`actionFailed` reused as-is for both mutations.

---

## Unit tests (`identity.service.spec.ts`)

`updateUser` additions: email-only update succeeds; duplicate email → `ConflictException`; email + fullName together. `resetPassword`: success (assert `hashPassword` was invoked with the plaintext, `prisma.user.update` called with the resulting hash, and `prisma.refreshToken.updateMany` called with `{ where: { userId: id, revokedAt: null }, data: { revokedAt: expect.any(Date) } }`); 404 for an unknown user id.

## E2E tests (`identity.e2e-spec.ts`)

401/403 for both routes. SuperAdmin success: change an existing (non-admin) user's email, confirm via `GET /identity/users`; duplicate-email attempt → 409. Password reset: reset a user's password, confirm login with the OLD password now fails (401) and with the NEW password succeeds (200) — and, the core proof of Design item 1, confirm a refresh token obtained **before** the reset now fails with 401 when presented to `POST /auth/refresh` **after** the reset.

## Component tests (`user-list-view.spec.tsx`)

Email blur-commit + no-op-when-unchanged; duplicate-email 409 shown verbatim; password-reset button disabled until 8+ characters; commits on click (not blur) with the exact `{ newPassword }` payload; input clears and a success message appears after a successful reset; 403/other-ApiError-verbatim/generic 3-way split on the reset mutation; regression — every existing test (rename, activate/deactivate, role/department Select, loading/error/empty) remains green, unweakened.

## Regression requirements

`create-user-view.spec.tsx` needs zero new test cases. `role-list-view.spec.tsx`, `branch-departments-view.spec.tsx`, `workspace-nav.spec.tsx` untouched, must remain green.

---

## Migration requirements

**None.** No Prisma schema change — `User.email`/`passwordHash` and `RefreshToken.revokedAt` already exist.

## Edge cases

- Changing email to the exact value it already holds → succeeds as a no-op (P2002 only fires against a genuinely different, colliding row).
- Resetting a password to a value ≥8 characters that happens to match the user's *old* password → succeeds (no "must differ from current" rule exists anywhere in this codebase; not invented here).
- A user with zero currently-active refresh tokens being reset → `revokeAllRefreshTokens`'s `updateMany` simply matches zero rows, no error.
- Resetting an inactive user's password → succeeds (Design item 5); they still cannot log in regardless, since `login`/`refresh` both already check `user.isActive`.

## Security risks/mitigations

- **Stale refresh tokens surviving a password reset** — mitigated by the new `revokeAllRefreshTokens` call (Design item 1); the standing, disclosed access-token-expiry limitation is unchanged and unaddressed, consistent with every other identity mutation in this codebase.
- **Privilege separation** — mitigated by giving password reset its own dedicated, `SuperAdmin`-only permission, distinct from the lower-stakes `user:update`.
- **Weak password policy** — this story deliberately does not raise the bar beyond the existing `MinLength(8)`; flagged as a pre-existing, unaddressed limitation shared with account creation, not newly introduced here.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e   # requires Docker/Postgres — unreachable in this session's environment; disclose honestly if still unreachable at implementation time
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `user:reset-password` permission key exists; `user:update` unchanged in meaning (now also covers `email`); `SuperAdmin` covers the new key automatically; `Agent` unchanged.
- [ ] `PATCH /identity/users/:id` accepts `email?`, rejects duplicates with 409.
- [ ] `PATCH /identity/users/:id/password` exists, hashes via the existing `hashPassword()`, and revokes all of the user's refresh tokens on success (e2e-proven).
- [ ] `/users` screen lets an admin edit a user's email inline and reset their password via an explicit click-to-commit control; no dialog introduced.
- [ ] English and Arabic translations exist for every new string.
- [ ] All listed tests exist and pass; other admin screens' specs remain green, unmodified.
- [ ] No Prisma migration introduced.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean (not yet committed).

---

## Non-Goals (explicit)

- Self-service "forgot password"/email-link flow, or any email-delivery infrastructure.
- Any password-complexity rule beyond the existing `MinLength(8)`.
- A confirm-password field or show/hide-password toggle.
- Revoking access tokens (JWTs) before their natural expiry.
- Any change to Role/Department/Branch assignment (Story 47) or Branch/Department/Role CRUD (Stories 45/46).
- Branch switching.
- Ticket/conversation work, Customer Portal, Channels, Knowledge Base, AI, Reporting, Integrations.
- Any README change.

---

## Dependencies

See Prerequisites. Hard sequencing: backend (DTOs → service → controller) must land and be typechecked before the frontend controls can be wired against a real endpoint.

## Known blockers

Docker Desktop unreachable in this session's environment — e2e cannot be executed here; the suite is designed and will be disclosed as not-run, not fabricated, exactly as for Stories 45–47.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
