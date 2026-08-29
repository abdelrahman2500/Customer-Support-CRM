# customer-portal-authentication-foundation — plan overview

Entry point for the **customer-portal-authentication-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 52  | [52-story-customer-portal-authentication-foundation.md](./52-story-customer-portal-authentication-foundation.md) | Customer Portal — Contact Authentication Foundation | — | `project-foundation` Stories 01–05 (the `audience: "agent" \| "customer"` JWT claim, reserved but unused until now), `customer-management` Story 06 (`Contact`), `agent-workspace-user-profile-correction` Story 48 (`resetPassword`'s exact agent-side-sets-a-password precedent) |

## Dependency notes

- Story 52 was selected via Next-Story Recon after `knowledge-base-foundation` Story 51. Communication/Channels and Integrations remain blocked on an undecided external provider/Integration Hub. Customer Portal was the next domain with no undecided dependency: `docs/architecture/05-auth-and-security.md` already reserves the `audience: "agent" | "customer"` JWT claim and `JwtStrategy`'s own doc comment already says "customer portal auth is a future story's `PortalModule`" — the repository was already deliberately staged for exactly this story.
- Of the two auth mechanisms the architecture names ("a separate email/password or magic-link flow"), this story implements **email/password only**. Magic-link requires sending an email, which requires the Communication/Channels domain's email adapter — not built, provider undecided. Email/password requires no new external dependency and mirrors the agent identity system's own already-working bcrypt/JWT/refresh-token mechanism exactly.
- **No self-registration.** A `Contact` gets portal access only when an agent explicitly sets a password for them (mirrors `agent-workspace-user-profile-correction` Story 48's `resetPassword` precedent for agent accounts) — this avoids the unresolved "how does a stranger prove they own this email" verification question, which — like magic-link — depends on email delivery infrastructure that does not exist yet.
- Story 52 deliberately stops at authentication only: login/refresh/logout/`me`. It does **not** implement `GET /portal/tickets` (view/track own tickets) or any other portal capability named in `docs/architecture/08-supporting-domains.md` — those are separate, future stories that build on this foundation without requiring any further change to the global auth-guard chain this story introduces. This mirrors `sla-policy-foundation` Story 10 and `knowledge-base-foundation` Story 51's own "foundation first" convention.
- Knowledge Base, Communication/Channels, AI Services, Reporting & Analytics, and Integrations remain separate, not-yet-started feature slugs. No story in this feature implements any of them.
