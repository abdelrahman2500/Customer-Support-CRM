# admin-branch-branding — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 62  | [62-story-admin-branch-branding.md](./62-story-admin-branch-branding.md) | Administration — Branch Branding (Foundation) | — | `audit-log-read-endpoint` Story 37 (the `admin` schema/module this joins) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2/§8) after Story 61, per the Feature Progress Audit: `docs/architecture/03-domain-boundaries.md`'s Administration row names "System configuration, branding, append-only audit logs" — only audit logs (Story 37) exists. With Notifications now closed (Stories 36/58/61), Reporting closed for v1 (Stories 56/59/60), and SLA & Automation's narrow v1 closed (Story 57), Administration/branding is the only remaining concrete, unblocked gap — every other undone item is either externally blocked (Channels/AI/Integrations) or has an explicit, unmet precondition before it can resume (SLA & Automation's wider action set needs a target-desync reconciliation design first; Notifications' live-toast template consumption was deliberately deferred).
- **Deliberately scoped to config + in-form preview only — no live application-wide CSS-variable consumption in either frontend app's shared layout.** `docs/architecture/08-supporting-domains.md` frames branding's defining behavior as "consumed by both Next.js apps through Tailwind CSS variables," which is real, separate, and materially riskier scope: it means editing the shared root layout/header in *both* `apps/web` and `apps/portal`, the exact kind of shared-rendering-surface change `docs/architecture/12-risks-tradeoffs-and-scope.md` already flags as a standing risk ("RTL/i18n regressions: physical-direction CSS silently breaks Arabic layouts"). This story ships the config data model, CRUD, and an admin-only preview (isolated to the new admin page, touching no other screen) — the live, shared-layout consumption is an explicit, separate follow-up once this foundation exists.
- No new Prisma schema — a new model within the already-declared `admin` schema, mirroring `AuditLog`'s own precedent from Story 37.
- Communication/Channels, AI Services, and Integrations remain blocked on an unresolved external provider/credential (unchanged).
