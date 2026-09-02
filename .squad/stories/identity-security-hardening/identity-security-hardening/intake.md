> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/identity-security-hardening/identity-security-hardening/intake.md`

---

## Feature

- **Feature name (display):** Identity & Access — Security Hardening
- **Feature slug (folder under `plans/`):** `identity-security-hardening`

## Title

```text
Story 100 — Identity & Access: Security Hardening
```

## Description

```text
Three concrete, already-diagnosed gaps in the auth surface: (1) the
Agent role is seeded with zero permissions and its "not yet" doc comment
is stale — every domain it referred to has since shipped; (2) the four
login/refresh endpoints (agent + portal) have no throttling beyond the
generic global default; (3) there is no way to revoke a customer
contact's portal access short of a direct DB write, and a deactivated
Customer's contacts can still authenticate against the portal. This story
closes all three, each by mirroring an exact existing pattern already
proven elsewhere in this codebase.
```

## Acceptance criteria

```text
- [ ] seed.ts's ROLE_GRANTS.Agent lists exactly: ticket:create/read/update,
      customer:create/read/update, branch:read, user:read, kb:read,
      quick-reply:read, notification:read, sla:read. Stale doc comment
      corrected.
- [ ] @Throttle({default:{limit:40,ttl:60_000}}) added to
      IdentityController.login/refresh and PortalController.login/refresh.
- [ ] New apps/api/test/auth-rate-limiting.e2e-spec.ts proves 429 after 40
      requests/60s on all four endpoints, in its own app instance, without
      breaking any existing spec file's login-dependent tests.
- [ ] New CustomersService.revokeContactPortalAccess(customerId,
      contactId): clears passwordHash to null, revokes all live
      ContactRefreshTokens.
- [ ] New PATCH /customers/:id/contacts/:contactId/portal-access/revoke,
      customer:update permission.
- [ ] ContactSummary gains hasPortalAccess: boolean (passwordHash !== null).
- [ ] PortalService.login and .refresh both reject when
      contact.customer.isActive is false, reusing each method's existing
      generic error message (no account-existence leak).
- [ ] Frontend: "Revoke portal access" button in customer-detail-view.tsx,
      shown only when hasPortalAccess is true, using the existing
      ConfirmDialog/destructive pattern.
- [ ] New/updated tests: customers.service.spec.ts, portal.service.spec.ts,
      relevant e2e specs, customer-detail-view.spec.tsx.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or its
      documented isolated-file fallback), pnpm --filter @crm/web test,
      pnpm typecheck, pnpm lint, and pnpm build all pass.
```

## Dependencies

- `identity-access-foundation` — `IdentityService`/`IdentityController`,
  `PermissionsGuard`/`@RequirePermissions`, `seed.ts`.
- Story 52 — `customer-portal-contact-auth-foundation`
  (`CustomersService.setContactPortalPassword`, `PortalService`,
  `Contact.passwordHash` nullable-as-"no access" semantic).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- New permission catalog entries.
- Account lockout / CAPTCHA / IP-ban — throttling only.
- `User.isActive` enforcement on the agent side — already exists.
- Role-permission-editing UI — already exists (Story 46).
- `GET /auth/me` / `GET /portal/auth/me` — mirrors the existing
  `getAuthenticatedUser` precedent of not re-checking `isActive` there.
