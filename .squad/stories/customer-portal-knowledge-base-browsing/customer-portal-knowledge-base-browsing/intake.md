> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Customer Portal — Knowledge Base Browsing
- **Feature slug:** `customer-portal-knowledge-base-browsing`

## Description

```text
Recon after Story 53 found "Knowledge Base browsing" named as a Portal capability alongside submit/track
tickets (done) and CSAT/feedback (still deferred). Knowledge Base (Story 51) has only one consumer today
(Agent Workspace) despite docs stating it's consumed by "the agent app, customer portal, and AI layer."
This story gives it its second. Scoped to read-only browsing of published articles only.
```

## Acceptance criteria

```text
- An authenticated portal Contact can list and read their branch's published Knowledge Base articles.
- A draft article is never visible via any portal route (404, same as cross-branch/unknown).
- An agent-audience token is rejected (401) on every new portal-KB route.
- English and Arabic translations exist for every new string in apps/portal.
- Backend unit and e2e tests, and frontend component tests, cover the new surface.
- No existing KnowledgeBaseService method is modified; only new, additive methods are introduced.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `knowledge-base-foundation` Story 51, `customer-portal-authentication-foundation` Story 52, `customer-portal-ticket-submission-tracking` Story 53.

## Out of scope

- Full-text/vector search, portal-side authoring, CSAT/feedback.
- Any README change.
