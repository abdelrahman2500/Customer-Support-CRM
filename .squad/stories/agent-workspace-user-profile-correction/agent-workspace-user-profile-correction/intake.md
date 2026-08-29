> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-user-profile-correction/agent-workspace-user-profile-correction/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — User Profile Correction (Email & Password)

- **Feature slug (folder under `plans/`):** `agent-workspace-user-profile-correction`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Agent Workspace — User Profile Correction: Email Change & Admin-Driven Password Reset
```

---

## Description

```text
A Next-Story Recon after Story 47 (User Role & Department reassignment) found the last remaining "fixed forever at creation" gap for a User record: an admin can now correct fullName, isActive, role, and department post-creation, but a user's email and password remain permanently fixed at creation. No DTO field, endpoint, or UI exists for either.

A focused investigation resolved the flagged security decision from direct repository evidence: does an admin-driven password reset need to revoke the target user's existing refresh tokens? Tracing the actual auth flow shows `refresh()` never checks the password hash and no mechanism links a `RefreshToken` to a password version — so without explicit revocation, a stolen-but-still-valid refresh token would survive a password reset entirely, defeating its purpose. This differs from user deactivation (which relies on `refresh()`'s `isActive` check and needs no explicit revocation, since that flag stays permanently false) — a password reset's entire point is credential invalidation, which the existing validation path cannot provide alone. A new `revokeAllRefreshTokens(userId)` helper is added, mirroring Story 41's single-token `revoke()` (logout) shape.

Following the exact precedent Stories 46/47 established for splitting a materially more sensitive action into its own permission key, password reset gets a new, dedicated `user:reset-password` permission (SuperAdmin-only initially); email change reuses the existing `user:update` (a plain profile-field edit, no privilege implication).
```

---

## Acceptance criteria

```text
- An admin holding `user:update` can correct an existing user's email address from the `/users` screen; duplicate emails are rejected with 409.
- An admin holding a new `user:reset-password` permission can set a new password for an existing user directly (admin-driven, not a self-service email-link flow).
- A successful password reset revokes every currently-active refresh token for that user — proven end-to-end (a refresh token obtained before the reset fails after it).
- Password validation mirrors the existing account-creation rule exactly (`MinLength(8)`) — no new complexity rule is introduced.
- Neither mutation is restricted based on the target user's `isActive` state, consistent with every other user field today.
- No dialog/modal is introduced — both mutations are inline controls on the existing `/users` screen, consistent with every prior admin mutation in this codebase.
- `user:reset-password` is granted to `SuperAdmin` automatically; `Agent`'s grants are unchanged.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and frontend component tests, cover both mutations, including 401/403/404/409 cases and the refresh-token-revocation proof.
- No Prisma migration is introduced.
- `create-user-view.spec.tsx` and every other existing admin screen's tests remain green, unmodified.
- Typecheck, lint, and build remain clean workspace-wide.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------- | --------------- |
| None                            | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `project-foundation` Story 02/03/04 (`User`/`RefreshToken`, `hashPassword`), `agent-workspace-session-refresh` Story 41 (`revoke()`/logout, extended here), `agent-workspace-user-admin` Story 32/38 (`UserListView`, `CreateUserView`'s password-field precedent), `agent-workspace-role-permission-management` Story 46 (the dedicated-permission-key precedent), `agent-workspace-user-role-assignment` Story 47 (row-level mutation and 3-way error-handling conventions).

- **Depends on code areas or other stories:** `apps/api/src/modules/identity/**` (service, controller, one extended DTO + one new DTO), `apps/api/prisma/seed.ts` (one new permission key). No Prisma schema/migration change. Touches `apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts`, `apps/web/src/components/users/user-list-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`. Does **not** touch `create-user-view.tsx`, Role/Department/Branch CRUD, or any ticket/customer/SLA code.

## Extra notes (optional)

- **No README changes** — consistent with every recent story's standing instruction.
- Disclosed, not fixed: an already-issued access token (JWT) cannot be revoked before its own short natural expiry — no blocklist mechanism exists anywhere in this codebase, the same limitation already disclosed for Role changes (Story 46) and user reassignment (Story 47).
- Considered and explicitly deferred, not silently added: a show/hide-password toggle and a confirm-password field — neither has any precedent anywhere in this codebase.

## Technical hints (optional)

- `resetPassword`'s refresh-token revocation should mirror `revoke()`'s (Story 41) exact Prisma-update shape, just scoped by `userId` instead of a single `tokenHash`.
- Email-uniqueness handling should follow the P2002-catch convention established by every mutation since Story 45 (`translateDuplicateBranchName`/`translateDuplicateDepartmentName`/`translateDuplicateRoleName`/`translateDuplicateUserAssignment`), not `createUser`'s older pre-check style (which is the one exception, justified only because `createUser` is the sole insert site for `User`).
- Both new UI controls belong in the existing email `TableCell` (grouped as "account identity" fields) — no new table column.

## Out of scope

- Self-service "forgot password"/email-link flow, or any email-delivery infrastructure.
- Any password-complexity rule beyond `MinLength(8)`.
- A confirm-password field or show/hide-password toggle.
- Revoking access tokens (JWTs) before their natural expiry.
- Role/Department/Branch assignment changes (Story 47) or Branch/Department/Role CRUD (Stories 45/46).
- Branch switching.
- Ticket/conversation, Customer Portal, Channels, Knowledge Base, AI, Reporting, Integrations work.
- Any README change.
