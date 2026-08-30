> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Ticket Attachments (Foundation)
- **Feature slug:** `ticket-attachments`

## Description

```text
A fresh Recon after Story 65 re-examined every remaining domain. AI Services, Communication/
Channels, and Integrations remain genuinely blocked (no working Anthropic credential beyond
squad-kit's own unrelated tooling token; no email/SMS/WhatsApp/ERP vendor decision exists
anywhere in the repository). Reporting already covers every named dimension. Knowledge Base's
two disclosed gaps (search, versioning) are both closed (Stories 64, 65). Attachments differ
from Channels/AI/Integrations in one key way: the backing service (MinIO, S3-compatible) is
already fully defined in docker-compose.yml with matching credentials already in apps/api/.env
and already scaffolded (unused) in env.validation.ts - it was simply never started. This is
self-hostable local infra, the same category as this repo's own already-running Postgres/Redis,
not an external vendor/credential decision. docs/architecture/04-data-and-multitenancy.md names
the exact intended shape ("Attachment binaries live in S3-compatible object storage; Postgres
stores key, filename, size, MIME type, and owning entity metadata") and it is completely
unimplemented anywhere in the codebase today. Selected.
```

## Acceptance criteria

```text
- POST /tickets/:id/attachments uploads a real file to MinIO and records its metadata;
  oversized (>10MB) or disallowed-MIME-type files are rejected before any S3 call.
- GET /tickets/:id/attachments lists a ticket's attachments.
- GET /tickets/:id/attachments/:attachmentId/download redirects to a working, short-lived
  presigned URL that returns the original bytes.
- Agent Workspace ticket detail view shows a working Attachments section (list + upload).
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests (against real MinIO), and frontend component tests, cover the
  new surface.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** none — `Ticket` model already exists; MinIO/S3 env
  configuration was pre-scaffolded since project foundation but never consumed until now.

## Out of scope

- Customer-level attachments (a separate, deferred follow-up story), attachment deletion,
  content/virus scanning, presigned-PUT direct-to-S3 upload, thumbnails/previews, re-upload
  versioning, any non-MinIO production object-storage provisioning, any README change.
