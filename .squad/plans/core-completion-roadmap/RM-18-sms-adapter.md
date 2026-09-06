# RM-18 — SMS Adapter

**Priority:** P0 (desired) · **Complexity:** Medium · **Blocked:** Yes · **Phase:** 5 (Email/WhatsApp/SMS)

## Goal

Implement a real `ChannelAdapter` for `SMS`, sending and receiving text
messages tied to a ticket.

## Blocked status

**PRODUCT-DECISION-BLOCKED — NO ZERO-COST PROVIDER CONFIRMED** (`02-
product-decisions.md`, Decision Record 3). Real SMS delivery to arbitrary
phone numbers rides on a metered telecom carrier/aggregator; the only
theoretical zero-SaaS-fee path (physical GSM hardware on a real, still-paid
mobile plan) is not genuinely zero-cost and is impractical/non-scalable.
Do not implement a fake/simulated SMS channel merely to mark this complete.

## Dependencies

`RM-13`, `RM-14` (both fully buildable now, independent of this decision).

## Backend / frontend / worker / schema / tests / acceptance / DoD

Not specified — cannot be meaningfully scoped until the product owner
either accepts a specific paid SMS aggregator, or explicitly decides this
channel stays unbuilt. Once unblocked, this story's shape mirrors `RM-15`'s
Email adapter pattern: a `ChannelAdapter` implementation, a signed inbound
webhook per the chosen provider's own scheme, outbound send via that
provider's API, tenant-scoped routing via a registered number-to-branch
mapping. SMS has no meaningful attachment/media support (a separate MMS
capability, provider-dependent) — scope explicitly text-only unless a
future need is disclosed.

## Definition of Done

Not applicable until unblocked by an explicit product decision.
