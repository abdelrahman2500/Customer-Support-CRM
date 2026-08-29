# agent-workspace-user-profile-correction — plan overview

Entry point for the **agent-workspace-user-profile-correction** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 48  | [48-story-agent-workspace-user-profile-correction.md](./48-story-agent-workspace-user-profile-correction.md) | Agent Workspace: User Profile Correction — Email Change & Admin-Driven Password Reset | — | `project-foundation` Story 02/03/04 (`User`/`RefreshToken` models, `hashPassword`, bcrypt), `agent-workspace-session-refresh` Story 41 (`revoke()`/logout mechanics, extended here), `agent-workspace-user-admin` Story 32/38 (`UserListView`, the password-field precedent in `CreateUserView`), `agent-workspace-role-permission-management` Story 46 (the "split a materially more sensitive action into its own permission key" precedent `user:reset-password` follows), `agent-workspace-user-role-assignment` Story 47 (the row-level immediate-commit mutation and 3-way error-handling conventions reused here) |

## Dependency notes

- Extends the existing `IdentityModule` (`identity.service.ts`, `users.controller.ts`, `dto/`) — no new module, no new controller file.
- **No Prisma schema change and no migration** — `User.email` and `User.passwordHash` already exist; `RefreshToken.revokedAt` already exists and is reused, not extended.
- **Resolved: password reset revokes all of the target user's existing refresh tokens.** `refresh()` never checks the password hash and no existing mechanism links a `RefreshToken` to a password version — so without explicit revocation, a stolen-but-still-valid refresh token would survive a password reset entirely, defeating its purpose. This differs deliberately from user deactivation (which relies on `refresh()`'s `isActive` check at the next attempt, sufficient because that flag stays permanently false) — a password reset's whole point is credential invalidation, which the existing token-validation path cannot provide on its own. A new `revokeAllRefreshTokens(userId)` helper is added, mirroring `revoke()`'s (Story 41's logout) exact shape but scoped by `userId` instead of a single `tokenHash`.
- **Email change reuses the existing `user:update` permission** (a plain profile-field edit, same risk class as `fullName`/`isActive`); **password reset gets its own new, dedicated `user:reset-password` permission**, following the exact precedent Story 46 (`role:assign-permissions` vs. `role:update`) and Story 47 (`user:reassign` vs. `user:update`) already established for actions materially more sensitive than a plain update. Granted to `SuperAdmin` automatically via the existing catalog-reference behavior; `Agent` unchanged.
- Email-uniqueness handling follows the P2002-catch convention established by every mutation since Story 45 (`translateDuplicateBranchName`/`translateDuplicateDepartmentName`/`translateDuplicateRoleName`/`translateDuplicateUserAssignment`) — not `createUser`'s older pre-check style, which is the one exception in this file (justified there only because `createUser` is the sole *insert* site).
- Password validation mirrors the one and only existing precedent (`create-user.dto.ts`'s `@MinLength(8)`) exactly — no new complexity rule is introduced.
- No restriction is added for inactive users — consistent with every other field on `User` today (`fullName`/`isActive`/`roleId`/`departmentId` are all already freely editable regardless of the user's current active state).
- No new UI primitive (dialog/modal) is introduced — none exists anywhere in this codebase today, and every prior admin mutation (including reassigning a SuperAdmin, deactivating a branch) commits inline with no confirmation step; this story follows that same convention rather than introducing the codebase's first modal purely for this one action.
