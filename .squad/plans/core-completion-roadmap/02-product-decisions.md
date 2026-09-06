# Product Decisions

This document separates decisions that belong to a product owner from work an
engineering session can safely start today. **The hard zero-cost constraint
applies throughout: no paid service, SaaS subscription, or billing requirement
may be introduced or assumed.** Preference order per that constraint: existing
infrastructure → free/open-source → self-hosted → local-dev-only → a
provider-neutral architecture left blocked until a genuinely free option is
confirmed. Where uncertain, this document marks **UNKNOWN / REQUIRES PRODUCT
DECISION** rather than assuming a free option exists.

---

## Decision Record 1 — Email

**Capability required:** send ticket-related messages to a customer's real
inbox and receive their replies back into the same ticket thread.

**What already exists, confirmed in code:** `docker-compose.yml` already runs
`mailhog` (SMTP `1025`, web UI `8025`) for local development — a zero-cost
SMTP sandbox that no code currently talks to (`ChannelType.EMAIL` is reserved
in the schema but never produced). No `nodemailer` or any SMTP client library
is currently a dependency of `apps/api` or `apps/worker`.

**Zero-cost analysis (outbound):** Unlike WhatsApp/SMS, email is an open,
self-hostable protocol. A self-hosted outbound relay (e.g. Postfix, or any
open-source MTA) can send real mail to real inboxes at zero recurring SaaS
cost. This is genuinely different from "no zero-cost option exists" —
self-hosted mail delivery is common, well-precedented open-source practice.
**However**, it carries real, non-monetary cost the product owner must
knowingly accept: SPF/DKIM/DMARC/reverse-DNS setup, IP/domain reputation
management, and a real risk of being spam-filtered by large mailbox providers
(Gmail, Outlook) without that setup done correctly and maintained. A capped
free tier of a transactional-email service, or a personal SMTP-relay account,
are alternate zero-monetary-cost paths with their own trade-offs (rate limits,
provider terms-of-service risk). None of these is "free with no cost of any
kind" — the cost is operational risk and setup effort, not a subscription fee,
which is exactly what the zero-cost constraint asks to prefer over a paid
SaaS.

**Zero-cost analysis (inbound):** Receiving mail requires either (a)
self-hosting a real internet-facing mail receiver (MX record + a running
SMTP-receiving service + spam/abuse handling — zero license cost, real ops
burden), or (b) an inbound-parse webhook from a commercial provider (typically
paid beyond a small free tier). (a) is the zero-cost-compatible path but is a
meaningfully larger, riskier undertaking than outbound (running an
internet-facing mail server safely is a serious operations commitment).

**Architecture impact:** A generic outbound message-delivery/status/retry
model (`RM-13`) and a `ChannelAdapter` interface (`RM-14`) are prerequisites,
already scoped provider-agnostically in Phase 4. An `EmailAdapter`
implementation (`RM-15` outbound, `RM-16` inbound) plugs into that seam.

**Credentials/secrets required:** an SMTP host/port/credentials pair (self-
hosted or a chosen relay) — added to `.env.example` alongside the existing
documented pattern, never committed.

**Webhook requirements:** none for outbound (SMTP is a direct protocol, not
webhook-based). Inbound requires either a running mail-receiver process or a
provider's inbound-parse webhook (only if a specific provider is later
chosen).

**Inbound/outbound message flow:** Outbound — a `ChannelMessage(EMAIL,
OUTBOUND)` row triggers a queued send job (reusing the same BullMQ pattern
already proven for AI processing and SLA timers) via the configured SMTP
transport; success/failure updates the delivery-status field `RM-13`
introduces. Inbound — a received message is parsed for the ticket-identifying
token (e.g. a reply-to address or subject-line ticket ID, mirroring how most
email-based support systems correlate replies) and written as a
`ChannelMessage(EMAIL, INBOUND)` against the matched ticket.

**Tenant isolation concerns:** the reply-to/ticket-token scheme must not leak
one branch's ticket identifiers in a way a different branch's inbound handler
could misroute — the eventual adapter must validate the resolved ticket's
`branchId` matches the receiving mailbox's configured branch before writing
the message, mirroring every other module's `TenantContext` pattern.

**Delivery/status events:** queued → sent → (optionally) bounced/failed,
persisted on the message row `RM-13` adds; no read-receipt tracking (out of
scope, no clean zero-cost mechanism for it over plain SMTP).

**Retry/idempotency concerns:** reuse the existing BullMQ retry/backoff
pattern already used elsewhere in this codebase; idempotency keyed on the
outbound `ChannelMessage.id` to avoid a duplicate send on retry.

**Attachment/media implications:** email attachments map naturally onto the
existing `TicketAttachment`/S3 storage pattern already used elsewhere — no new
storage mechanism needed, only MIME-parsing on inbound and MIME-encoding on
outbound.

**Estimated engineering scope:** Medium (outbound), Medium (inbound) — see
`RM-15`/`RM-16`.

**What can proceed now, without a decision:** the entire outbound send path
can be built and fully tested today against the already-running Mailhog
sandbox — zero new cost, zero new decision needed for *development*. This is
explicitly called out in `RM-15` as "buildable now, gated before production
rollout."

**Status: PRODUCT DECISION REQUIRED** — not "no zero-cost option exists" (one
plausibly does, self-hosted), but the specific choice of self-host vs. a
capped free-tier relay vs. an eventual paid ESP, and the acceptance of the
deliverability/ops risk that comes with either zero-cost path, is a real
product decision this session must not make unilaterally.

---

## Decision Record 2 — WhatsApp

**Capability required:** send and receive WhatsApp messages tied to a ticket.

**Zero-cost analysis:** WhatsApp has no self-hostable protocol — the only
legitimate integration path is Meta's WhatsApp Business Cloud API, which
requires business verification, a registered phone number, and (beyond a
limited free allotment of "service conversations" per month, with tiers that
change over time) moves to per-conversation billing at real usage. Unofficial
browser-automation libraries (e.g. driving WhatsApp Web) exist and are
nominally free, but violate WhatsApp's Terms of Service, are liable to get the
number banned, and are unsuitable for a serious product — not a legitimate
zero-cost substitute, only a fragile workaround. There is no confirmed way to
operate this channel at guaranteed zero cost at real production volume.

**Architecture impact / credentials / webhooks / flow / isolation / retries /
attachments:** all identical in shape to Email's Decision Record above once a
provider is chosen (`ChannelAdapter` interface, signed inbound webhook per
Meta's `X-Hub-Signature-256` scheme, outbound queued send, tenant-scoped
routing, BullMQ retry, media via the same attachment pattern) — not detailed
further here since the channel itself cannot proceed without the decision
below.

**Estimated engineering scope (once unblocked):** Medium-Large — see `RM-17`.

**Status: PRODUCT-DECISION-BLOCKED — NO ZERO-COST PROVIDER CONFIRMED.** Do not
implement a fake/mocked "WhatsApp" channel merely to mark this core complete.

---

## Decision Record 3 — SMS

**Capability required:** send and receive SMS tied to a ticket.

**Zero-cost analysis:** Real SMS delivery to arbitrary phone numbers rides on
a telecom carrier or an aggregator, virtually always metered per message. The
only theoretical zero-SaaS-fee path is physical GSM hardware (a modem + a
real SIM card on a real, still-paid mobile plan) — not a genuine zero-cost
option (a recurring carrier bill still exists), and impractical/non-scalable
for a real support operation. No confirmed zero-cost provider exists for this
channel.

**Estimated engineering scope (once unblocked):** Medium — see `RM-18`.

**Status: PRODUCT-DECISION-BLOCKED — NO ZERO-COST PROVIDER CONFIRMED.**

---

## Decision Record 4 — ERP / External Integrations

**What can be built provider-agnostically now, confirmed zero-cost, using
only existing infrastructure:**

- **Integration Hub foundation** — a generic `WebhookSubscription` model,
  outbound event-dispatch queue (reusing BullMQ, already present), and a
  pluggable inbound-webhook receiver with swappable signature verification.
  Zero new infrastructure — Postgres + Redis + BullMQ, all already running.
- **Adapter interface + registry** — the `ChannelAdapter`/`ErpAdapter`-shaped
  interface `docs/architecture/09-integrations.md` already describes in
  prose, formalized as real TypeScript interfaces with a registry resolving
  which adapter (if any) handles a given type. This is pure internal
  refactoring/scaffolding — no vendor, no cost.
- **Credential abstraction** — a generic, encrypted-at-rest credential slot
  per integration (reusing the existing `.env`/secrets-hygiene convention;
  no new secrets-management product needed).
- **API keys / M2M authentication** — an internal `ApiKey` model + Passport
  strategy alongside the existing JWT strategy. Zero external dependency.
- **Event model, outbound delivery/retry, inbound webhook verification,
  tenant isolation, auditability** — all directly buildable on infrastructure
  already proven elsewhere in this codebase (BullMQ retry/backoff, JWT/
  `TenantContext` scoping, the `AuditLog`/`AuditInterceptor` pattern).

All of the above is **fully unblocked and zero-cost** — see `RM-20`, `RM-21`,
`RM-22` in Phase 6.

**What remains genuinely blocked:** the ERP adapter itself. There is no
generic "ERP" to build against — `docs/architecture/09-integrations.md`'s own
words: *"The specific ERP and protocol (REST, SOAP, or file-based) remain
open until a future story names them."* Inventing a target ERP or protocol
would violate the task's explicit "do not invent an ERP" instruction and would
not be a real capability once built. No zero-cost analysis is meaningful
without knowing what system is being integrated with — most real-world ERPs
(SAP, Oracle, Microsoft Dynamics, NetSuite) are themselves paid enterprise
products; a genuinely free/open-source ERP target (e.g. ERPNext, Odoo
Community Edition) is plausible but has not been named by this product.

**Status: BLOCKED — external ERP/protocol selection required.** This is a
target-system decision, not fundamentally a cost decision (the *adapter*
engineering is zero-cost regardless of which ERP is eventually named) — kept
separate from the zero-cost gate for that reason, though whichever ERP is
named should itself be evaluated against the same zero-cost preference order
before being adopted.

---

## Decision Record 5 — AI Suggested Solutions (feasibility check, not a provider decision)

**Question asked:** can this be implemented using the existing Anthropic
architecture, without introducing a new AI provider?

**Answer: yes — confirmed, and it introduces no new decision at all.**

- **Required data/context:** identical shape to the existing four AI
  capabilities — a ticket's subject + notes (already loaded by
  `TicketAiService.loadAiTicketInput`) plus a full-text search over published
  `KnowledgeBaseArticle` rows (the exact retrieval mechanism already built and
  proven for the portal chatbot's own KB-grounding step, `apps/worker/src/
  queues/ai-processing.processor.ts`'s `fetchKnowledgeBaseContext`).
- **Prompt boundary:** a new prompt method on the existing `AiProvider`
  interface (`packages/ai/src/ai-provider.interface.ts`), mirroring
  `summarize`/`suggestReply`/`categorize`/`chat` exactly — no new SDK, no new
  vendor, no new credential.
- **Async job behavior:** identical to the other four — `TicketAiService`
  creates a `PENDING` `AiPromptLog` row, enqueues to the existing
  `ai-processing` BullMQ queue, `AiProcessingProcessor` in `apps/worker`
  performs the call.
- **Persistence:** a new `AiFeature` enum value (`SUGGEST_SOLUTIONS`) on the
  existing `AiPromptLog` model — no new table.
- **Realtime event:** reuses the existing `ai.prompt_completed` event/room
  already relayed by `TicketRealtimeListener`.
- **UI:** a new card in `TicketDetailView`, mirroring `TicketAiCard`'s
  existing shape, offering a "reference on ticket" action that pairs
  naturally with `RM-05` (Ticket ↔ KB Linkage).
- **Disabled/error states:** reuses `AiSettingsService.isFeatureEnabled` and
  `NullAiProvider`'s existing graceful `DISABLED` behavior verbatim — no new
  disabled-state logic to invent.
- **Tests:** mirrors the existing `ticket-ai.service.spec.ts`/
  `ai-processing.processor.spec.ts` coverage shape for the other four
  capabilities.

**Zero-cost implication:** this story introduces **no new mandatory cost**.
It rides on the exact same optional `ANTHROPIC_API_KEY` gate the other four
AI capabilities already use, and correctly resolves to `DISABLED` when that
key is absent — local development remains fully functional without it, per
the constraint's own AI section.

**Status: UNBLOCKED — no product decision required.** See `RM-00`.

---

## Zero-Cost Feasibility Matrix

Conservative by design — a plausible-but-uncertain path is marked
`PRODUCT DECISION REQUIRED` or `UNKNOWN`, never assumed free.

| Capability | Zero-cost possible? | Self-hosted possible? | Local dev possible? | External credentials required? | Paid provider required? | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Email (outbound) | Plausible, with real ops/deliverability trade-offs | Yes (self-hosted SMTP relay) | Yes — already running (Mailhog) | Only if a relay/service is chosen instead of self-hosting | Not strictly required | **PRODUCT DECISION REQUIRED** |
| Email (inbound) | Plausible, larger ops burden (real mail-receiving server) | Yes, in principle | Yes, against Mailhog for outbound; inbound needs its own local setup | Only if an inbound-parse provider is chosen | Not strictly required | **PRODUCT DECISION REQUIRED** |
| WhatsApp | No confirmed zero-cost path at real volume | No (proprietary protocol) | Limited (Meta developer sandbox/test numbers only) | Yes (Meta Business API) | Effectively yes beyond a limited free tier | **PRODUCT-DECISION-BLOCKED — NO ZERO-COST PROVIDER CONFIRMED** |
| SMS | No | No (carrier-dependent; hardware-modem path still requires a paid SIM/carrier plan) | Only as a dev-mode stub (not real delivery) | Yes | Yes | **PRODUCT-DECISION-BLOCKED — NO ZERO-COST PROVIDER CONFIRMED** |
| ERP (unspecified) | Unknown — depends entirely on which ERP | Unknown | Unknown | Unknown | Unknown (most named enterprise ERPs are paid; free/open-source ERPs exist but none has been chosen) | **UNKNOWN / REQUIRES PRODUCT DECISION** |
| Integration Hub foundation (webhooks, adapter registry, API keys/M2M) | Yes | Yes — reuses existing Postgres/Redis/BullMQ | Yes, fully | No | No | **Confirmed zero-cost, unblocked** |
| AI Suggested Solutions | Yes (reuses existing optional Anthropic key, correctly DISABLED without it) | N/A (external LLM call by design, same as the 4 existing AI features) | Yes — DISABLED state is fully functional and tested without a key | Only if AI is desired at all (already an accepted, existing exception) | No new requirement | **Confirmed zero-cost, unblocked** |
| Mobile-responsive layouts, reporting charts, Ticket↔KB linkage, Tasks & Reminders, Customer Notes, ticket status transitions, presence-in-workspace, System Settings, locale-routing tests | Yes | Yes (all internal engineering, no external service of any kind) | Yes, fully | No | No | **Confirmed zero-cost, unblocked** |
