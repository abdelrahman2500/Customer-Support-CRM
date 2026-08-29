> **Source:** autonomous Next-Story Recon (no tracker).

# Story intake

- Folder: `.squad/stories/customer-portal-authentication-foundation/customer-portal-authentication-foundation/intake.md`

## Feature

- **Feature name (display):** Customer Portal — Contact Authentication Foundation
- **Feature slug (folder under `plans/`):** `customer-portal-authentication-foundation`

## Description

```text
Next-Story Recon after Story 51 (knowledge-base-foundation) found Customer Portal still a placeholder.
Communication/Channels and Integrations remain blocked on an undecided external provider. Customer
Portal has no such blocker: docs/architecture already reserves an audience: "agent" | "customer" JWT
claim, unused until now, and JwtStrategy's own doc comment already flags "customer portal auth is a
future story's PortalModule" — the repo was already staged for this. Of the two auth mechanisms the
architecture names (email/password or magic-link), only email/password is buildable today without a
new external dependency (magic-link needs email delivery, which needs the not-yet-built Channels
domain). No self-registration is implemented — an agent sets a Contact's initial portal password,
mirroring Story 48's resetPassword precedent exactly, avoiding the unresolved "prove you own this
email" question a public signup flow would raise.
```

## Acceptance criteria

```text
- An agent can set a portal password for an existing Contact via a new, customer:update-gated route.
- That Contact can log into apps/portal with email/password and reach an authenticated home page.
- A customer-audience token is rejected on every existing agent-facing route, and an agent-audience
  token is rejected on every new portal route (proven by an e2e test).
- No new permission key is introduced for the agent-side password-set route.
- No self-registration, forgot-password, or magic-link flow exists.
- English and Arabic translations exist for every new string in both apps.
- Backend unit and e2e tests, and frontend component tests (both apps), cover the new surface.
- Exactly one Prisma migration is introduced (Contact.passwordHash + a new ContactRefreshToken table).
- Every pre-existing test suite remains green, unweakened — especially the shared, global auth guard
  chain (JwtStrategy/AuthGuard/app.module.ts) this story modifies.
```

## Dependencies

- **Blocked by / related ids:** `project-foundation` Stories 01–05, `customer-management` Story 06, `agent-workspace-user-profile-correction` Story 48.
- **Depends on code areas:** `apps/api/src/common/auth/**`, new `apps/api/src/modules/portal/**`, `apps/api/src/modules/customers/**`, `apps/api/prisma/schema.prisma`, `apps/api/src/app.module.ts`; new `apps/portal/src/lib/**`, new portal route files, new portal test infra; `apps/web/src/components/customers/customer-detail-view.tsx` (+hooks/api/i18n).

## Out of scope

- Ticket submission/tracking, Knowledge Base browsing, CSAT/feedback in the portal.
- Self-registration, forgot-password, magic-link, any email delivery.
- Communication/Channels, Integrations, AI Services, Reporting.
- Any README change.
