> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Knowledge Base — Article Version History (Foundation)
- **Feature slug:** `knowledge-base-article-versioning`

## Description

```text
A fresh Recon after Story 64 re-examined every remaining domain. AI Services' vendor is already
decided (Anthropic Claude per docs/architecture/12-risks-tradeoffs-and-scope.md) but no working
API credential exists anywhere in this repo (only squad-kit's own unrelated tooling OAuth token
does) - treated as blocked per the same class of "required external credential" gap CLAUDE.md
§9.B names for Channels, since the domain's entire value is an untestable-without-it live LLM
call. Reporting already covers every named dimension (ticket volume/SLA/CSAT from Story 56,
agent performance from Story 59, ticket aging from Story 60) - a further Reporting story would
invent scope. Communication/Channels and Integrations remain genuinely blocked (no
provider/ERP decision exists in the repo). Knowledge Base's own architecture doc
(08-supporting-domains.md) names "publishing creates a new version rather than mutating
published content" as intended design, and Story 51's own plan explicitly deferred it as "a
future, separately-planned story" - no external blocker, extends an existing module's existing
boundary. Selected.
```

## Acceptance criteria

```text
- Publishing an article (status -> PUBLISHED) creates an immutable KnowledgeBaseArticleVersion
  snapshot of the content becoming live; re-publishing after an edit creates a further,
  correctly-sequenced version with the new content.
- A plain content edit or an unpublish (status -> DRAFT) never creates a version.
- GET /knowledge-base/articles/:id/versions works, kb:read-gated, 404s identically to GET :id
  for an unknown/cross-branch article id.
- Agent Workspace shows a read-only Version History section on the existing article detail view.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and a frontend component test, cover the new surface.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `knowledge-base-foundation` Story 51.

## Out of scope

- Restore/rollback to a past version, diffing/highlighting between versions, versioning a
  DRAFT-only edit or an unpublish transition, any Customer Portal exposure, any new permission
  key, any README change.
