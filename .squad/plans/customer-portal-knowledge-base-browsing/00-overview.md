# customer-portal-knowledge-base-browsing — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 54  | [54-story-customer-portal-knowledge-base-browsing.md](./54-story-customer-portal-knowledge-base-browsing.md) | Customer Portal — Knowledge Base Browsing | — | `knowledge-base-foundation` Story 51, `customer-portal-authentication-foundation` Story 52 |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2) after Story 53. `docs/architecture/08-supporting-domains.md` names "Knowledge Base browsing" as a `PortalModule` capability alongside "submit ticket, view and track own tickets, history" (Story 53, done) and CSAT/feedback (still deferred). `docs/architecture/03-domain-boundaries.md`'s Knowledge Base row states articles are "consumed by the agent app, customer portal, and AI layer" — today only the agent app does; this story gives it its second real consumer.
- AI Services and Reporting & Analytics were evaluated and deprioritized: both are larger, riskier lifts (AI needs a new external SDK dependency/queue/schema even though the vendor is already decided; Reporting has no urgent consumer) with no dependency-correctness reason to go first. Communication/Channels and Integrations remain blocked on an undecided external provider (unchanged).
- Scoped to read-only browsing of already-**published** articles only — no search (full-text/vector search remains Story 51's own disclosed deferral; this story does not touch it), no portal-side authoring, no CSAT/feedback (a separate future story).
- Portal KB scope is the Contact's Customer's **branch** (articles are branch-owned, not customer-owned, unlike Tickets) — the JWT's existing `branchId` claim, already stamped correctly at login (Story 52's `PortalService.issueAccessToken`), is used directly; no extra lookup is needed (unlike Story 53's ticket endpoints, which needed a `customerId` the JWT doesn't carry).
