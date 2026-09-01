# channels-quick-replies — plan overview

Entry point for the **channels-quick-replies** feature. Stories execute in
order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 91  | [91-story-channels-quick-replies.md](./91-story-channels-quick-replies.md) | Communication/Channels — Quick Replies | — | `customer-portal-live-chat` Story 77/78 (`ChannelsModule`, `ChannelMessagesService`, `apps/web`'s `TicketChatCard`/`ChatComposer` — the exact insertion point this story's picker attaches to), `sla-automation-rules` Story 57 (`AutomationRulesService`/`AutomationRulesController`/`AutomationRulesView` — the exact "branch-admin resource, arbitrary list, isActive toggle" CRUD shape this story mirrors), `notification-templates` Story 61 (`NotificationTemplatesService` — the exact "branch-admin resource, no cross-entity validation" service shape this story's simpler service mirrors) |

## Dependency notes

- Selected via a fresh, whole-repository Recon after Story 90
  (`CLAUDE.md` §2/§8). Story 90's own plan doc explicitly named this exact
  gap and explicitly declined it only because, at that time, a different
  candidate (Customer Portal notification preferences) was more directly
  dependency-correct — "a one-step-away completion of infrastructure
  already fully built," vs. quick replies needing "new schema/UI built
  from nothing." That more-directly-dependent candidate is now shipped
  (Story 90), so this recon re-evaluated the full domain table fresh
  rather than assuming quick replies was automatically next.
- **Recon performed this round** (see this story's own "Context" section
  for the specific files read): `docs/architecture/03-domain-boundaries.md`
  (the full domain table), `docs/architecture/06-communication-and-realtime.md`,
  `docs/architecture/09-integrations.md`,
  `docs/architecture/12-risks-tradeoffs-and-scope.md`,
  `docs/architecture/07-sla-automation-and-ai.md`,
  `docs/architecture/08-supporting-domains.md`,
  `docs/architecture/05-auth-and-security.md`; every `apps/api/src/modules/*`
  directory listing; `apps/api/prisma/schema.prisma`'s full model/enum list;
  `apps/api/prisma/seed.ts`'s permission catalog; the reporting, admin, and
  notifications controllers' route lists; `git log --oneline -30`; and
  `.squad/plans/00-index.md` in full.
- **Why this, over other candidates surfaced during Recon:**
  - *Communication/Channels — `EMAIL`/`WHATSAPP`/`SMS` producers* and
    *Integrations* (ERP/external adapters) remain ineligible per
    `CLAUDE.md` §2 — no concrete provider decision exists anywhere in the
    repository (`docs/architecture/12-risks-tradeoffs-and-scope.md` still
    records "Revisit when: Not expected to be revisited" for the
    buy-channels policy; `docs/architecture/09-integrations.md` still
    describes the ERP adapter's protocol as open until a future story names
    it). Unchanged since every prior Recon note back to Story 77.
  - *Communication/Channels — "threads"* (the domain table's third named
    noun) is not yet a real gap: every channel currently reachable
    (`LIVE_CHAT`, `AI_CHAT`, `WEB_FORM`) is synchronous and ticket-scoped —
    `Ticket` itself already is the thread. `ChannelMessage.externalThreadId`
    already exists in the schema (added by Story 77) precisely for this,
    but stays nullable/unused by design — its own doc comment says
    verbatim "it exists for the other four channel types' future stories,
    not invented use here." `docs/architecture/06-communication-and-
    realtime.md`'s "maps to a ticket via `Ticket.externalRef` and its
    external thread id" sentence describes the still-provider-blocked
    email/WhatsApp/SMS channels specifically (no `Ticket.externalRef`
    column exists yet either). A dedicated `Thread` model/UI would be
    speculative infrastructure for channels that don't exist yet — exactly
    the "do not introduce abstractions to anticipate future, unplanned
    work" caution in `CLAUDE.md` §2.2.
  - *Communication/Channels — "channel configuration"* (the domain table's
    first named noun) has no concrete, currently-blocked-on-nothing shape
    either: the only channels live today (`LIVE_CHAT`/`AI_CHAT`/`WEB_FORM`)
    have no per-branch enable/disable requirement disclosed anywhere, and
    inventing one would be exactly the kind of unrequested abstraction
    `CLAUDE.md` §2.2 warns against, unlike quick replies, which the domain
    table already names as an owned noun with a concrete, already-visible
    UI seam (`ChatComposer`).
  - *Administration — "system configuration"* (the domain table's
    Administration row) has no concrete undone item disclosed by any prior
    story, plan, or architecture doc beyond branding (Story 62, shipped)
    and audit logs (Story 84, shipped) — too vague to be "traceable to a
    concrete gap" per `CLAUDE.md` §2's opening instruction.
  - *Reporting's "saved dashboards"*, *"mark as read"/unread-count state*,
    and *SSO/magic-link auth* — each a real, previously-disclosed non-goal,
    but none has a newly-satisfied prerequisite this round (unchanged from
    Stories 88/89/90's own rejections; no existing per-user
    dashboard-configuration or `NotificationLog.isRead` groundwork exists
    to extend).
  - Every other domain (Identity & Access, Customer Management, Ticketing,
    SLA & Automation, Knowledge Base, AI Services, Notifications, Reporting
    & Analytics, Customer Portal) already has deep, multi-story coverage
    with no concrete disclosed gap surfaced by this Recon.
- **Dependency correctness**: builds only on infrastructure already fully
  in place and untouched by this story — `ChannelsModule`
  (Story 77, gains its first controller, nothing existing modified),
  `TicketChatCard`/`ChatComposer` (Story 78, extended the same additive way
  `NotificationTemplatesView` and other admin views were added alongside
  existing screens).
- **Architectural coherence**: `QuickReply` is a new model in the
  `channels` schema, owned by `ChannelsModule` — exactly matching
  `docs/architecture/03-domain-boundaries.md`'s own table cell ("channel
  configuration, inbound/outbound messages, **threads, quick replies**").
  The service/controller/permission shape mirrors `AutomationRulesService`/
  `AutomationRulesController` (Story 57) and `NotificationTemplatesService`
  (Story 61) file-for-file — both already-proven "branch-admin resource"
  patterns in this exact codebase.
- **Product value**: closes the one remaining concretely-named, non-
  provider-blocked gap in the Communication/Channels domain row, and gives
  agents a real efficiency tool (canned responses insertable into the
  existing ticket chat composer) — the kind of day-to-day agent-workspace
  value this project has consistently prioritized (Stories 44-50, 78).
- **Risk reduction**: none specific; purely additive (new table, new
  routes, one new module surface, one extended component) — no existing
  route, table, or component behavior changes for a caller who never
  touches the new endpoints or the new picker.
- **Smallness**: the smallest concretely-scoped gap identified across the
  whole-repository Recon — a three-endpoint CRUD resource with no
  cross-entity validation (unlike `AutomationRule`, which validates
  `actionAssignToUserId`/`actionSetDepartmentId` against the branch), plus
  one small addition to an existing component.
