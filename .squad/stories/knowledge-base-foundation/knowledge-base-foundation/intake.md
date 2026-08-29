> **Source:** autonomous Next-Story Recon (no tracker).

# Story intake

- Folder: `.squad/stories/knowledge-base-foundation/knowledge-base-foundation/intake.md`

---

## Feature

- **Feature name (display):** Knowledge Base Foundation (Agent Workspace Article Management)
- **Feature slug (folder under `plans/`):** `knowledge-base-foundation`

## Title

```text
Knowledge Base Foundation (Agent Workspace Article Management)
```

## Description

```text
Next-Story Recon performed after Story 50 (agent-workspace-ticket-internal-notes) found six domains
from docs/architecture/03-domain-boundaries.md with zero implementation: Communication/Channels,
Knowledge Base, AI Services, Reporting & Analytics, Customer Portal, Integrations. Communication/Channels
was rejected as the next story because it depends on an undecided external provider (email/WhatsApp/SMS)
and the Integration Hub, neither of which the repository has resolved — an architectural decision that
cannot safely be inferred (see docs/architecture/12-risks-tradeoffs-and-scope.md). Knowledge Base was
selected instead: it has no undecided external dependency, the Prisma datasource already provisions the
pgvector/pg_trgm extensions anticipating it, and it is a named future dependency of both Customer Portal
and AI Services. This story pairs the new `knowledge_base` schema with its own first real consumer (an
Agent Workspace admin screen), mirroring the sla-policy-foundation + agent-workspace-sla-policy-admin
precedent, so no speculative schema is added without something using it.
```

## Acceptance criteria

```text
- An agent holding `kb:create` can create a draft article (title, body, optional category).
- An agent holding `kb:read` can list/view their branch's articles (all statuses).
- An agent holding `kb:update` can edit an article's fields and toggle it between DRAFT and PUBLISHED.
- No delete route exists. No full-text/vector search is implemented in this story.
- Cross-branch or nonexistent article ids are rejected with 404 for all four routes.
- Agent Workspace gains a new "Knowledge Base" nav item and list/create/detail-edit screens with
  correct loading/error/empty/populated states.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and frontend component tests, cover the new endpoints/UI, including
  401/403/404/400 cases.
- Exactly one Prisma migration is introduced (new schema + enum + table).
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `project-foundation` Stories 01–05, `agent-workspace-sla-policy-admin` Story 31, `agent-workspace-navigation-menu` Story 44, `agent-workspace-role-permission-management` Story 46 (how a deployment would later grant `kb:*` to `Agent`).
- **Depends on code areas:** new `apps/api/src/modules/knowledge-base/**`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/src/app.module.ts`; new `apps/web/src/lib/knowledge-base-api.ts`, `apps/web/src/hooks/use-knowledge-base.ts`, `apps/web/src/components/knowledge-base/**`, new route files under `apps/web/src/app/[locale]/(agent)/knowledge-base/**`; touches `apps/web/src/components/workspace/workspace-nav.tsx` and `apps/web/messages/{en,ar}.json`.

## Out of scope

- Full-text/vector search, multi-version publish history, article deletion, attachments, tags.
- Customer Portal, AI Services, Communication/Channels, Reporting, Integrations.
- Any README change.
