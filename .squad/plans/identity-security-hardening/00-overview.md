# identity-security-hardening — plan overview

Entry point for the **identity-security-hardening** feature. Stories
execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 100 | [100-story-identity-security-hardening.md](./100-story-identity-security-hardening.md) | Identity & Access — Security Hardening | — | `identity-access-foundation` (auth/RBAC), `customer-portal-contact-auth-foundation` Story 52 (portal password model) |

## Dependency notes

- Selected via the same whole-repository Recon that produced
  `reporting-resolution-time-metrics` (Story 99) — this was the
  second-ranked candidate of the four surfaced, queued next per that
  Recon's own sequencing.
- **Why this, over Customer list search or KB full-text search:** applying
  the same 8-point ranking (dependency value > user-facing value > domain
  completeness > unblocking > security > testability > no external
  dependency > bounded size), this story scores highest on **security** —
  three concrete, already-diagnosed gaps sit in the authentication/
  authorization surface every other domain depends on:
  1. `Agent`, the only non-admin role that exists, is seeded with **zero**
     permissions (`apps/api/prisma/seed.ts`'s own `ROLE_GRANTS.Agent = []`
     and its now-stale comment "No ticketing/customer/etc. permissions yet
     ... those land with the stories that introduce those domains" — every
     one of those stories has since landed, and the comment was never
     updated). A freshly seeded `Agent` cannot do anything without a
     SuperAdmin manually granting permissions first.
  2. `POST /auth/login`, `/auth/refresh`, `/portal/auth/login`,
     `/portal/auth/refresh` have no throttling beyond the generic global
     default — a credential-stuffing/brute-force surface on the exact
     endpoints where that matters most.
  3. There is no way to revoke a customer contact's portal access once
     granted short of a direct DB write, and a deactivated `Customer`
     (`isActive: false`) can still have its contacts log into the portal —
     `PortalService.login`/`refresh` never check it.
- **Dependency correctness**: builds only on infrastructure already fully
  in place — `seed.ts`'s reconciliation loop, `ThrottlerModule`'s existing
  `@Throttle` override pattern (`web-form-intake.controller.ts`'s
  precedent), and `Contact.passwordHash: null` (already the established
  "no portal access" semantic per that model's own doc comment, Story 52).
  No new schema for (a) or (c)'s revocation mechanism.
- **Architectural coherence**: no new module, no new permission model, no
  new auth flow — every change is inside the existing
  `IdentityModule`/`PortalModule`/`CustomersModule` boundaries.
- **Product value / risk reduction**: closes real, exploitable gaps in the
  auth surface without touching any external-provider-blocked domain.
- **Smallness**: three independently-small, tightly-scoped fixes, each
  mirroring an exact existing pattern (no new abstractions).
