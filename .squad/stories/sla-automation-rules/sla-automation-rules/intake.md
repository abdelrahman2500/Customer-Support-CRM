> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** SLA & Automation — Automation Rules Foundation
- **Feature slug:** `sla-automation-rules`

## Description

```text
Recon after Story 56 found AutomationRule (docs/architecture/07-sla-automation-and-ai.md's "SLA &
automation" section) as the only remaining unimplemented, unblocked domain concept — AI Services'
vendor is settled but needs a real API credential this environment lacks (a genuine, narrower
blocker), and Communication/Channels/Integrations remain provider-blocked. Scoped to a single,
safe action (auto-assign to an agent) that touches no SLA-policy-matching field, avoiding a real
SLA-target desync risk a wider action set would introduce.
```

## Acceptance criteria

```text
- POST/GET/PATCH /automation-rules exist, gated by a new automation:* permission, branch-scoped.
- A real ticket.created event evaluates active rules (category match, else wildcard) and assigns
  the first match's agent, but never overrides an explicit assignedToUserId.
- The automated assignment appears in the ticket's history/timeline (via the existing
  ticket.updated subscriber, no new listener there).
- A new Agent Workspace screen lists/creates/toggles rules.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and a frontend component test, cover the new surface.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `ticketing` Story 07/08 (`TICKET_CREATED_EVENT`), `sla-policy-foundation` (the module this joins), `sla-breach-escalation` (`TicketEscalationListener`'s cross-domain-write pattern).

## Out of scope

- Trigger types beyond ticket.created; actions beyond auto-assignment (category/priority/department
  excluded — SLA-policy-matching fields); rule ordering UI; multi-condition DSL; AI-assisted rules;
  a full workflow engine.
- Any README change.
