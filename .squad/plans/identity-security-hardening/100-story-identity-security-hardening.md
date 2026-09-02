# Story 100 — Identity & Access: Security Hardening

## Prerequisites

- `identity-access-foundation` — `IdentityService`/`IdentityController`,
  `PermissionsGuard`/`@RequirePermissions`, `seed.ts`'s reconciliation loop.
- `customer-portal-contact-auth-foundation` Story 52 —
  `CustomersService.setContactPortalPassword`, `PortalService`,
  `Contact.passwordHash` nullable-as-"no access" semantic.
- `web-form-intake.controller.ts`'s `@Throttle({default:{limit,ttl}})`
  override precedent (Story unindexed, already merged).

All are complete and already merged to `main`.

## Story Goal

Close three concrete, already-diagnosed gaps in the authentication/
authorization surface:

1. Seed a sensible default `Agent` permission set (currently `[]`).
2. Add dedicated, stricter throttling to the four login/refresh endpoints.
3. Add portal-contact access revocation, and enforce `Customer.isActive`
   during portal authentication.

## Non-Goals

- No new permission catalog entries — (1) only changes which existing
  catalog keys `Agent` is granted.
- No account lockout / CAPTCHA / IP-ban mechanism — throttling only, via
  the existing `ThrottlerModule`, mirroring the one existing override
  precedent.
- No change to `User.isActive` enforcement on the agent-side
  `login`/`refresh` — `IdentityService` already checks it (Recon-confirmed:
  `identity.service.ts`'s `login`/`refresh` both reject `!user.isActive`).
  This story's `isActive` gap is specific to the **portal** side, which has
  no equivalent check today.
- No UI for editing arbitrary role permissions (Role management already
  exists via `PATCH /roles/:id/permissions`, Story 46) — (1) only changes
  the seed's own default grant list for a fresh/reseeded database.
- No change to `getAuthenticatedUser`/`getAuthenticatedContact`
  (`GET /auth/me` / `GET /portal/auth/me`) — mirrors the exact existing
  precedent: `IdentityService.getAuthenticatedUser` does **not** re-check
  `user.isActive` either (Recon-confirmed), so `getAuthenticatedContact`
  staying consistent with that is not a new inconsistency introduced here.
  Deactivation is enforced at `login`/`refresh` (session issuance), exactly
  where the existing `User.isActive` check already lives.

## Design decisions

1. **Default `Agent` permissions** (`apps/api/prisma/seed.ts`). Every
   permission a frontline agent needs to do real ticket work with the
   existing web app's own features, deliberately excluding every
   admin/configuration-only permission:
   ```ts
   const ROLE_GRANTS: Record<string, readonly string[]> = {
     SuperAdmin: PERMISSION_CATALOG,
     Agent: [
       "ticket:create",
       "ticket:read",
       "ticket:update",
       "customer:create",
       "customer:read",
       "customer:update",
       "branch:read",
       "user:read",
       "kb:read",
       "quick-reply:read",
       "notification:read",
       "sla:read",
     ],
   };
   ```
   - `ticket:*` / `customer:*` (create/read/update, no delete permission
     exists in the catalog for either) — the core of an agent's job.
   - `branch:read` — the existing branch-scoped UI shell reads branch
     metadata; already effectively public-within-branch, not an admin
     concern.
   - `user:read` — assigning a ticket to a colleague, or seeing "who is
     this assigned to," requires listing users in the branch
     (`GET /users`).
   - `kb:read` — using the Knowledge Base while working a ticket (never
     `kb:create`/`kb:update` — authoring is a supervisor/admin concern).
   - `quick-reply:read` — using existing quick replies on a ticket (never
     `quick-reply:create`/`update` — authoring quick replies is an admin
     concern).
   - `notification:read` — the existing notification bell/unread-count
     feature (Story 92) has no permission gate documented as admin-only;
     an agent must see their own notifications.
   - `sla:read` — the ticket detail view's SLA countdown display needs to
     read SLA policy data.
   - Deliberately **excluded**: `role:*`, `permission:read`,
     `branch:update`, `department:*`, `audit:read`, `report:read`,
     `automation:*`, `branding:*`, `ai:*`, `sla:create`/`update`,
     `notification:create`/`update`, `user:create`/`update`/`reassign`/
     `reset-password`, `quick-reply:create`/`update`, `kb:create`/`update`
     — every one of these is a configuration, authoring, or
     people-management action, not frontline ticket work. (Ticket
     AI-assist buttons are gated by `ticket:read`, not `ai:read` —
     confirmed by Recon — so excluding `ai:*` does not block agents from
     using them.)
   - The seed's reconciliation loop (`$transaction([deleteMany,
     createMany])` per role, already idempotent) applies this on every
     `prisma:seed` run — an existing database's `Agent` role is corrected
     the same way a fresh one is seeded, with zero migration needed (this
     is grant data, not schema).
   - The stale "No ticketing/customer/etc. permissions yet" doc comment is
     corrected to describe the actual, current grant list and why.

2. **Auth-endpoint throttling.** `@Throttle({ default: { limit: 40, ttl:
   60_000 } })` (import `Throttle` from `@nestjs/throttler`, exact same
   shape as `web-form-intake.controller.ts`'s existing override) on:
   - `IdentityController.login`
   - `IdentityController.refresh`
   - `PortalController.login`
   - `PortalController.refresh`

   `40` was chosen, not an arbitrarily tight number, because each e2e spec
   file boots its own fresh `INestApplication` (and therefore its own
   fresh, isolated `ThrottlerStorage`) in `beforeAll` — call counts do not
   accumulate *across* spec files, only *within* one file's run — and
   `identity.e2e-spec.ts` alone calls agent-login **25 times** in its own
   run (Recon-confirmed grep count), the highest of any existing spec file
   for either endpoint family. `40` sits comfortably above every existing
   spec file's real usage while still being meaningfully stricter than the
   generic global default (`100`/`60s`, per `app.module.ts`).

   New, **dedicated** e2e file `apps/api/test/auth-rate-limiting.e2e-spec.ts`
   (not added to `identity.e2e-spec.ts` or `portal.e2e-spec.ts`) — a
   loop-until-429 test necessarily exhausts a full 60-second throttle
   window for the endpoint under test, which would otherwise poison those
   files' own, unrelated login-dependent tests running in the same window.
   Mirrors `channels-web-form.e2e-spec.ts`'s existing loop-until-429
   pattern. Boots its own app instance so its throttle exhaustion never
   leaks into any other spec file.

3. **Portal-contact access revocation + `Customer.isActive` enforcement.**
   - New `CustomersService.revokeContactPortalAccess(customerId,
     contactId)`, mirroring `setContactPortalPassword`'s exact
     validate-then-`$transaction` shape: confirm the contact exists and
     belongs to `customerId` (`NotFoundException` otherwise), then
     `$transaction([contact.update({ where: { id }, data: { passwordHash:
     null } }), contactRefreshToken.updateMany({ where: { contactId,
     revokedAt: null }, data: { revokedAt: new Date() } })])`. No
     duplicate-email or new-password validation needed (unlike
     `setContactPortalPassword`) — this only clears state.
   - New route `PATCH /customers/:id/contacts/:contactId/portal-access`
     with body `{ action: "revoke" }`... **simplified to no body**: a
     dedicated `DELETE`-shaped semantic reads clearer than an action enum
     for a single, one-directional operation. Final shape:
     `PATCH /customers/:id/contacts/:contactId/portal-access/revoke`,
     `@RequirePermissions("customer:update")` (mirrors the existing
     portal-password route's exact permission — this is the same
     "managing a customer contact's access" capability, not a new one).
   - `ContactSummary` (`customers.service.ts`) gains `hasPortalAccess:
     boolean`, derived in `toContactSummary` as `contact.passwordHash !==
     null` — the frontend needs this to conditionally render a "Revoke"
     affordance only when there is something to revoke.
   - `PortalService.login` gains a `Customer.isActive` check, mirroring
     `IdentityService.login`'s exact `!user.isActive` precedent (same
     rejection point — at credential verification/session issuance, not at
     `/me`) and its exact "don't leak which emails exist" messaging
     convention: the existing generic `UnauthorizedException("Invalid
     email or password")` is reused for `!contact.customer.isActive` too
     (no new, more specific message — a specific "your organization's
     account is deactivated" message would leak that the email is
     otherwise valid).
   - `PortalService.refresh` gains the same `!contact.customer.isActive`
     check (its existing query already `include`s `customer`), mirroring
     `IdentityService.refresh`'s exact `!user.isActive` re-check on every
     rotation — a customer deactivated mid-session must not be able to
     keep refreshing indefinitely. Reuses the existing generic
     `UnauthorizedException("Refresh token is invalid or expired")`
     message (`refresh`'s own existing convention), not a new one.
   - Frontend: a "Revoke portal access" button in
     `customer-detail-view.tsx`'s `ContactRow`, shown only when
     `hasPortalAccess` is `true`, using the existing `ConfirmDialog`
     pattern with `variant="destructive"` (mirrors this codebase's other
     destructive-action confirmations), positioned next to the existing
     "Set portal password" affordance.

## Files expected to change

**Backend**
- `apps/api/prisma/seed.ts` — `ROLE_GRANTS.Agent`, corrected doc comment.
- `apps/api/src/modules/identity/identity.controller.ts` — `@Throttle` on `login`/`refresh`.
- `apps/api/src/modules/portal/portal.controller.ts` — `@Throttle` on `login`/`refresh`.
- `apps/api/src/modules/portal/portal.service.ts` — `isActive` check in `login`/`refresh`.
- `apps/api/src/modules/portal/portal.service.spec.ts` — new tests for the `isActive` check.
- `apps/api/src/modules/customers/customers.service.ts` — `revokeContactPortalAccess`, `ContactSummary.hasPortalAccess`.
- `apps/api/src/modules/customers/customers.service.spec.ts` — new tests.
- `apps/api/src/modules/customers/contacts.controller.ts` — new revoke route.
- `apps/api/test/customers.e2e-spec.ts` (or contacts-specific spec) — e2e coverage for revoke + `hasPortalAccess`.
- `apps/api/test/portal.e2e-spec.ts` — e2e coverage for the `isActive` login/refresh rejection.
- `apps/api/test/auth-rate-limiting.e2e-spec.ts` — new, dedicated file.

**Frontend**
- `apps/web/src/components/customers/customer-detail-view.tsx` — "Revoke portal access" button + confirm dialog.
- `apps/web/src/lib/customers-api.ts` (or equivalent) — new API call + `hasPortalAccess` on the contact type.
- `apps/web/src/components/customers/customer-detail-view.spec.tsx` — new tests.
- `apps/web/messages/{en,ar}.json` — new strings for the revoke button/dialog.

## Acceptance / Done Criteria

- A freshly seeded (or re-seeded) `Agent` role has exactly the 12
  permissions listed in Design decision 1 — no more, no less.
- `POST /auth/login`, `/auth/refresh`, `/portal/auth/login`,
  `/portal/auth/refresh` return `429` after 40 requests within 60 seconds
  from the same client, verified in the new dedicated e2e file, without
  breaking any existing spec file's own login-dependent tests.
- `PATCH /customers/:id/contacts/:contactId/portal-access/revoke` clears
  the contact's password hash and revokes all live refresh tokens; a
  subsequent portal login/refresh with the old credentials/token fails.
- `ContactSummary.hasPortalAccess` correctly reflects `passwordHash !==
  null` before and after both setting and revoking.
- A contact belonging to a `Customer` with `isActive: false` cannot log
  into the portal, and an already-issued refresh token for such a contact
  cannot be rotated, both with the existing generic error messages (no
  account-existence leak).
- All existing identity/portal/customers unit and e2e tests continue to
  pass unmodified in their assertions (only additive changes).

## Verification Plan

- `apps/api` unit: `customers.service.spec.ts` (new `revokeContactPortalAccess`
  tests), `portal.service.spec.ts` (new `isActive` tests) — then the full
  `pnpm --filter @crm/api test`.
- `apps/api` e2e: new `auth-rate-limiting.e2e-spec.ts` run in isolation
  first (`npx vitest run test/auth-rate-limiting.e2e-spec.ts
  --no-file-parallelism`), new assertions in `portal.e2e-spec.ts` and the
  customers/contacts e2e spec run in isolation, then a full
  `pnpm --filter @crm/api test:e2e` sweep (accepting the pre-existing,
  documented `identity.e2e-spec.ts`/`realtime-socketio-foundation.e2e-spec.ts`
  isolation defects as unrelated, per `CLAUDE.md` §5/§13).
- `apps/web`: new `customer-detail-view.spec.tsx` tests, then full
  `pnpm --filter @crm/web test`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `git status --short` / `git diff --stat` review before commit — confirm
  `apps/api/src/modules/identity/identity.service.ts` (already committed
  independently by the user as `7b3cad6`, unrelated to this story) is not
  touched by this story's diff.
