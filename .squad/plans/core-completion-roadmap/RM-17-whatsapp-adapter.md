# RM-17 — WhatsApp Adapter

**Priority:** P0 (desired) · **Complexity:** Medium-Large · **Blocked:** Yes · **Phase:** 5 (Email/WhatsApp/SMS)

## Goal

Implement a real `ChannelAdapter` for `WHATSAPP`, sending and receiving
messages tied to a ticket via the WhatsApp Business Cloud API.

## Blocked status

**PRODUCT-DECISION-BLOCKED — NO ZERO-COST PROVIDER CONFIRMED** (`02-
product-decisions.md`, Decision Record 2). No self-hostable protocol exists;
Meta's official API requires business verification and moves to per-
conversation billing beyond a limited free allotment. Unofficial
browser-automation libraries violate WhatsApp's Terms of Service and are
unsuitable for a serious product. Do not implement a fake/simulated
WhatsApp channel merely to mark this complete — this violates both the
zero-cost constraint's "never fake completion" instruction and the "do not
invent providers" instruction.

## Dependencies

`RM-13`, `RM-14` (both fully buildable now, independent of this decision).

## Backend / frontend / worker / schema / tests / acceptance / DoD

Not specified — cannot be meaningfully scoped until the product owner
either accepts Meta's paid tiers beyond the free allotment, or explicitly
decides this channel stays unbuilt. Once unblocked, this story's shape
mirrors `RM-15`/`RM-16`'s Email adapter pattern closely: a `ChannelAdapter`
implementation, a signed inbound webhook (Meta's `X-Hub-Signature-256`
scheme, per `docs/architecture/05-auth-and-security.md`'s own already-
written intent), outbound send via the Cloud API, media via the existing
attachment pattern, tenant-scoped routing via the registered WhatsApp
Business phone number mapping to a specific branch.

## Definition of Done

Not applicable until unblocked by an explicit product decision.
