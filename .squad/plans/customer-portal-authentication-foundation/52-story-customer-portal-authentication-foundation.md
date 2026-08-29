# Story 52 — Customer Portal — Contact Authentication Foundation

## Prerequisites

- `project-foundation` Stories 01–05: `JwtAccessTokenClaims.audience: "agent" | "customer"` (already reserved, unused by any `customer`-audience issuance until now); `AuthGuard`/`JwtStrategy`/`TenantMiddleware` (`common/auth`, `common/tenant`).
- `customer-management` Story 06: `Contact` model, `CustomersService`/`ContactsController`.
- `agent-workspace-user-profile-correction` Story 48: `resetPassword`'s exact "an admin sets a new password directly, no forgot-password email flow, revokes existing sessions" precedent — the direct template for how a `Contact` gets portal credentials.
- `identity.service.ts`'s `login`/`refresh`/`revoke`/`hashPassword`/refresh-token mechanism — the exact mechanism this story's `PortalService` mirrors for `Contact` instead of `User`.

---

## Story Goal

Let a `Contact` log into `apps/portal` with an email/password an agent has set for them, and see a minimal authenticated home page confirming who they are — the first real capability of the Customer Portal domain, and the first time the already-reserved `audience: "customer"` JWT claim is actually issued and accepted anywhere. This closes the "Customer Portal is a placeholder" gap named in `docs/architecture/08-supporting-domains.md` and `project-foundation`'s own explicit non-goals.

**Not in scope**: ticket submission/tracking, Knowledge Base browsing, CSAT/feedback (all named in `docs/architecture/08-supporting-domains.md`'s Customer Portal section but requiring their own dedicated stories once this foundation exists); self-registration or a "forgot password" flow (no email delivery infrastructure exists); magic-link auth; any Communication/Channels/Integrations code.

---

## Context — Read These Files First

1. `apps/api/src/modules/identity/identity.service.ts` — `login`/`refresh`/`revoke`/`resetPassword`/`hashPassword`/`issueAccessToken`/`createRefreshTokenRecord`/`hashRefreshToken` — the exact mechanism mirrored below, for `Contact` instead of `User`.
2. `apps/api/src/modules/identity/identity.controller.ts` — the exact `/auth/login`/`/auth/refresh`/`/auth/logout`/`/auth/me` route shape, cookie handling (`REFRESH_COOKIE_NAME`), this story's `PortalController` mirrors exactly (different cookie path/name so an agent session and a portal session on the same browser never collide).
3. `apps/api/src/common/auth/jwt.strategy.ts` — currently hard-rejects any non-`"agent"` audience; this story removes that (moves the audience decision to a new guard, see Design item 3).
4. `apps/api/src/realtime/realtime.gateway.ts` (line ~61) — its own, *separate* `audience !== "agent"` socket rejection is unrelated to this story and is NOT touched — portal has no realtime capability yet.
5. `apps/api/prisma/schema.prisma` — `Contact` model (its own doc comment already states email is unique **per Customer**, not globally — Design item 2 below resolves the login-lookup implication of that).
6. `apps/web/src/lib/api.ts` + `apps/web/src/lib/auth-server.ts` + `apps/web/src/app/[locale]/(auth)/login/page.tsx` + `apps/web/src/app/[locale]/(agent)/layout.tsx` — the exact client-side token/cookie/refresh mechanism and SSR-auth-guard-layout pattern this story's `apps/portal` equivalents mirror file-for-file, retargeted to `/portal/auth/*`.
7. `apps/web/src/components/users/user-list-view.tsx` (`UserRow`'s password-reset UI) — the exact "agent sets a new password inline, success message, revokes existing sessions" UI pattern this story's new "Contact portal password" control (on `CustomerDetailView`'s existing `ContactRow`) mirrors.

---

## Design decisions

1. **New `customers`-schema model `ContactRefreshToken`**, not a widened `identity.refresh_tokens`. Mirrors `RefreshToken` exactly (`tokenHash` unique, `expiresAt`/`revokedAt`/`replacedBy`, `onDelete: Cascade` on its `Contact` FK) but is its own table — avoids any risk to the already-battle-tested `identity.refresh_tokens`/`User` relationship, and keeps the `customers` schema owning everything about a `Contact`'s lifecycle, per `docs/architecture/03-domain-boundaries.md`.
2. **`Contact.passwordHash` is nullable** — a `Contact` has no portal access until an agent sets one. **Login-lookup safety**: `Contact.email` is unique only **per Customer** (its own doc comment: "the same real person's email may legitimately appear under a different Customer"), so a plain `findFirst({ where: { email } })` could match the wrong Customer's Contact if two shared an email. Resolved at the **application** layer, mirroring `createUser`'s existing duplicate-email `ConflictException` precedent: setting a `Contact`'s portal password is rejected with `ConflictException` if any *other* Contact already has a password set with that same email. `login()` then queries `findFirst({ where: { email, passwordHash: { not: null } } })`, safe by that write-time invariant. This is a disclosed, deliberate resolution of a real ambiguity using an existing precedent — not a new abstraction.
3. **Audience enforcement moves out of `JwtStrategy` into a new, explicit guard.** `JwtStrategy.validate()` now accepts either audience (no hard rejection) — Passport's job is "is this a validly-signed, unexpired token," not "which surface may use it." A new `AudienceGuard` (registered globally via `APP_GUARD`, immediately after `AuthGuard` and before `PermissionsGuard`) enforces: a route marked `@PortalRoute()` requires `audience === "customer"`; every other authenticated route (the entire existing agent-facing surface, unchanged) requires `audience === "agent"`. This is the same reflector/decorator shape as `@Public()`/`IS_PUBLIC_KEY` already established — not a new pattern.
4. **No RBAC/permission key for portal routes.** Contacts have no role/permission concept anywhere in this codebase (that system is agent-only). Portal authorization is the audience claim alone, exactly as `docs/architecture/05-auth-and-security.md` describes: "Tokens carry `audience: agent` or `audience: customer` so audiences cannot cross endpoints." `PermissionsGuard` is unaffected (`@RequirePermissions` is simply never applied to `PortalController`, and it already no-ops when no permission metadata is present).
5. **Separate cookie name and path** (`crm_portal_access_token` / `crm_portal_refresh_token`, path `/api/v1/portal/auth`) — an agent and a customer session in the same browser (e.g. an agent testing the portal) never collide with the existing `crm_access_token`/`refreshToken` cookies.
6. **Agent-side password set, not self-registration**: `PATCH /customers/:customerId/contacts/:contactId/portal-password`, reusing the existing `customer:update` permission (mirrors `createContact`'s "reuse the parent domain's permission" precedent — no new key). Mirrors `resetPassword` exactly: sets the password, revokes every existing `ContactRefreshToken` for that contact (Story 48's "a password reset invalidates existing sessions" rule).
7. **Frontend**: `apps/portal` gets its first real screens — a login page (mirrors `apps/web`'s login page file-for-file) and a `(customer)` route-group layout that SSR-resolves the authenticated contact (mirrors `(agent)/layout.tsx`'s `fetchCurrentUser`/redirect pattern exactly) wrapping a minimal home page showing "Signed in as {fullName}" and a sign-out button. `apps/web` gains one new inline control on the existing `ContactRow` (in `CustomerDetailView`) so an agent can actually set a Contact's portal password from the UI.
8. **Portal test infrastructure**: `apps/portal` has zero component tests today. This story adds the same `vitest.config.mts` + jsdom + `@testing-library/react` setup `apps/web` already uses (mirrored, not reinvented) so the new login/home components can be tested the same way every other screen in this codebase is.

---

## Implementation Tasks

### Backend

1. **`packages/shared/src/auth.ts`** — add `AuthenticatedContact { id; email; fullName; customerId }`, mirroring `AuthenticatedUser`'s shape for a `Contact`.
2. **`apps/api/prisma/schema.prisma`**:
   - `Contact.passwordHash String? @map("password_hash")`, `Contact.refreshTokens ContactRefreshToken[]`.
   - New model `ContactRefreshToken` (see Design item 1), `customers` schema.
3. **Migration** — generated via `prisma migrate dev` against the real local Postgres.
4. **`apps/api/src/common/auth/jwt.strategy.ts`** — `validate()` no longer audience-checks; returns any validly-signed payload.
5. **New `apps/api/src/common/auth/portal-route.decorator.ts`** — `@PortalRoute()`, mirrors `@Public()`'s `SetMetadata` shape exactly.
6. **New `apps/api/src/common/auth/audience.guard.ts`** — `AudienceGuard` (see Design item 3); a request with no `request.user` (an unauthenticated `@Public()` route) passes through untouched — `AuthGuard` is what rejects those, not this guard.
7. **`apps/api/src/app.module.ts`** — register `AudienceGuard` as `APP_GUARD`, between `AuthGuard` and `PermissionsGuard`; import `PortalModule`.
8. **New `apps/api/src/modules/portal/`**:
   - `dto/portal-login.dto.ts` — mirrors `LoginDto` exactly.
   - `portal.service.ts` — `login`/`refresh`/`revoke`/`getAuthenticatedContact`, mirroring `identity.service.ts`'s equivalents field-for-field, against `prisma.contact`/`prisma.contactRefreshToken`, issuing `{ sub: contact.id, audience: "customer", branchId: contact.customer.branchId, departmentId: null, roles: [] }`.
   - `portal.controller.ts` — `@Controller("portal/auth")`: `POST login`/`POST refresh`/`POST logout` (`@Public()`), `GET me` (`@PortalRoute()`), same cookie mechanism as `IdentityController` (Design item 5).
   - `portal.module.ts` — imports `AuthModule` (for `JwtService`), registers controller/service.
9. **`apps/api/src/modules/customers/customers.service.ts`** — new `setContactPortalPassword(customerId, contactId, dto)`: verifies the contact belongs to the customer (mirrors every existing contact-mutation's ownership check), enforces the Design item 2 duplicate-email-among-portal-contacts check, hashes the password, revokes all of that contact's existing `ContactRefreshToken`s.
10. **`apps/api/src/modules/customers/contacts.controller.ts`** — `PATCH :id/contacts/:contactId/portal-password` (`customer:update`).
11. **`apps/api/prisma/seed.ts`** — no change (no new permission key).
12. **Tests** — see Test Plan.

### Frontend

13. **`apps/portal/src/lib/api.ts`** — mirrors `apps/web/src/lib/api.ts` exactly, retargeted to `/portal/auth/*` and the new cookie names.
14. **`apps/portal/src/lib/auth-server.ts`** — mirrors `apps/web`'s `fetchCurrentUser`, calling `GET /portal/auth/me`, returning `AuthenticatedContact | null`.
15. **`apps/portal/src/app/[locale]/(auth)/login/page.tsx`** — mirrors `apps/web`'s login page file-for-file, retargeted.
16. **`apps/portal/src/app/[locale]/(customer)/layout.tsx`** — mirrors `(agent)/layout.tsx`'s SSR-redirect-if-unauthenticated pattern; **`(customer)/home/page.tsx`** — "Signed in as {fullName}" + a sign-out button (mirrors `WorkspaceNav`'s sign-out logic, trimmed to what a single page needs).
17. **`apps/portal` test infrastructure** — `vitest.config.mts`, `src/test/setup.ts`, new devDependencies (`@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react`, `vite`), mirroring `apps/web` exactly.
18. **`apps/web/src/lib/tickets-api.ts`** / **`apps/web/src/hooks/use-tickets.ts`** — `CreateContactPortalPasswordInput`/`setContactPortalPassword`/`useSetContactPortalPasswordMutation`, mirroring `resetPassword`/`useResetPasswordMutation` exactly.
19. **`apps/web/src/components/customers/customer-detail-view.tsx`** — `ContactRow` gains an inline "set portal password" control, mirroring `UserRow`'s password-reset UI exactly (min-length-8 input, submit button, success message, revokes-sessions note).
20. **i18n** — new `apps/portal` `auth`/`home` namespaces (both locales); additive `customers.detail.portalPassword*` keys in `apps/web`'s `en.json`/`ar.json`.
21. **Tests** — see Test Plan.

---

## API contract

- `POST /portal/auth/login` — `@Public()` — body `{ email, password }` — sets the portal refresh cookie, returns `{ accessToken }`; 401 for unknown email, no password set yet, or wrong password (never distinguishing which).
- `POST /portal/auth/refresh` / `POST /portal/auth/logout` — `@Public()` — identical cookie-based mechanism to the agent equivalents.
- `GET /portal/auth/me` — `@PortalRoute()` — returns `AuthenticatedContact`; 401 without a valid `customer`-audience token; 401 (via `AudienceGuard`) for a valid `agent`-audience token.
- `PATCH /customers/:id/contacts/:contactId/portal-password` — `customer:update` — body `{ newPassword }` (min 8 chars) — returns `{ id }`; 404 for a contact not belonging to that customer/branch; 409 if another contact already has portal access with the same email.

## Authorization / tenant-scoping rules

Portal routes are audience-scoped, not branch-scoped (a `Contact` has no branch role) — `AudienceGuard` is the entire authorization surface for `PortalController`. The agent-side `portal-password` route reuses the exact same `findContactInScope`-style ownership check every other contact mutation already uses (customer/branch scoping via `TenantContext`).

## Tests

**Backend unit** (`portal.service.spec.ts`, mirrors `identity.service.spec.ts`'s login/refresh shape; extend `customers.service.spec.ts` for `setContactPortalPassword`; new `audience.guard.spec.ts` mirroring `permissions.guard.spec.ts`'s mock-reflector shape):
- `login`: wrong/unknown email, no password set, wrong password all reject identically with `UnauthorizedException`; correct credentials issue a `customer`-audience token and a refresh record.
- `refresh`/`revoke`: mirror `identity.service.spec.ts`'s exact rotation/revocation assertions, against `ContactRefreshToken`.
- `setContactPortalPassword`: 404 for a contact outside the customer; 409 for a duplicate email among portal-enabled contacts; success hashes the password and revokes existing refresh tokens.
- `AudienceGuard`: allows an agent-audience token on a non-portal route and rejects a customer-audience token there (and vice versa for a `@PortalRoute()`-marked route); passes through when `request.user` is absent.

**Backend e2e** (`portal.e2e-spec.ts`): full login → me → refresh → logout lifecycle for a Contact with a portal password set by the admin via the real `PATCH .../portal-password`; 401 for wrong credentials; 401 for a valid *agent* access token presented to `GET /portal/auth/me`; 401 for a valid *customer* portal token presented to an existing agent-only route (e.g. `GET /tickets`) — the key regression proof that audience separation actually works end-to-end.

**Frontend component**: `apps/web`'s `customer-detail-view.spec.tsx` gains portal-password-control tests (mirrors `user-list-view.spec.tsx`'s reset-password tests). `apps/portal` gains its first-ever component tests for the login page and the authenticated home page.

## Regression requirements

Every existing backend/frontend test suite remains green, unweakened — especially every existing agent-facing e2e route, since `JwtStrategy`/`app.module.ts`'s guard chain is shared, global infrastructure this story modifies.

## Migration requirements

One migration: `Contact.password_hash` column + the new `contact_refresh_tokens` table. No existing table altered beyond that additive column.

## Security risks/mitigations

- **Audience confusion is the central risk this story introduces** — mitigated by moving the audience check into one explicit, reflector-driven guard (`AudienceGuard`) applied globally, plus an e2e test proving each audience is rejected on the other's routes.
- **No new self-registration attack surface** — only an already-authenticated, already-permissioned agent can set a Contact's portal password.
- **Cross-customer login-lookup risk** (Design item 2) resolved by a write-time uniqueness invariant, enforced with the same `ConflictException` pattern `createUser` already uses.
- **Session invalidation on password change** — mirrors Story 48's `resetPassword` exactly: every existing `ContactRefreshToken` is revoked.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

Re-confirm the CURRENT baseline pass counts directly before adding new tests.

## Done criteria

- [ ] `Contact.passwordHash` + `ContactRefreshToken` exist; migration applied.
- [ ] `POST/GET /portal/auth/*` exist and work end-to-end; `AudienceGuard` proven (by e2e test) to reject each audience on the other's routes.
- [ ] `PATCH /customers/:id/contacts/:contactId/portal-password` exists, gated by the existing `customer:update` (no new permission key).
- [ ] `apps/portal` has a real login page and an authenticated home page, both SSR-guarded like `apps/web`'s agent workspace.
- [ ] `apps/web`'s `CustomerDetailView` lets an agent set a Contact's portal password inline.
- [ ] Both locales translated for every new string (both apps).
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean (not yet committed).

---

## Non-Goals (explicit)

- Ticket submission/tracking, Knowledge Base browsing, CSAT/feedback in the portal.
- Self-registration; "forgot password"/magic-link flows; any email delivery.
- Any Communication/Channels, Integrations, AI Services, or Reporting code.
- Any change to `realtime.gateway.ts`'s own, separate agent-audience socket check.
- Any README change.

---

## Dependencies

See Prerequisites. Hard sequencing: shared types → schema/migration → `JwtStrategy`/`AudienceGuard` → `PortalModule` → agent-side portal-password endpoint → both frontends, in that order.

## Known blockers

None known at plan time — Docker/Postgres confirmed reachable this session.
