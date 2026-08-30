> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Customer Attachments (Foundation)
- **Feature slug:** `customer-attachments`

## Description

```text
A fresh Recon after Story 66 re-examined every remaining domain. AI Services/Channels/
Integrations remain genuinely blocked (unchanged reasoning from prior Recons). Reporting and
Knowledge Base are both covered to their documented depth. Customer Attachments is the second,
previously-deferred named consumer of "Ticket/customer attachments"
(docs/architecture/01-technology-stack.md) - Story 66's own plan explicitly named it as the
next follow-up once AttachmentsModule/S3StorageService existed. No external blocker; reuses
Story 66's already-built-and-verified S3 client, bucket, and size/MIME-limit infrastructure
unchanged. Selected.
```

## Acceptance criteria

```text
- POST/GET /customers/:id/attachments and GET .../download work identically to their
  ticket-side (Story 66) counterparts - same size/MIME validation, same presigned-URL-as-JSON
  download shape.
- Customer Workspace detail view shows a working Attachments card (list + upload), reusing the
  same UI shape Story 66 built for tickets.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests (against real MinIO), and frontend component tests, cover the new
  surface.
- Every pre-existing test suite remains green, unweakened - especially every Story 66
  ticket-attachment test.
```

## Dependencies

- **Blocked by / related ids:** `ticket-attachments` Story 66 (`AttachmentsModule`,
  `S3StorageService`, `attachment-limits.ts` — all reused unchanged).

## Out of scope

- Everything Story 66 already deferred (deletion, content/virus scanning, presigned-PUT direct
  upload, thumbnails/previews, re-upload versioning, non-MinIO production provisioning), any
  README change.
