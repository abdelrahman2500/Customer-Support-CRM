# Feature overview — Customer Attachments (Foundation)

## Why this feature, why now

`docs/architecture/03-domain-boundaries.md`'s domain table names "attachment
metadata" under Customer Management generically, and
`docs/architecture/01-technology-stack.md` names both intended consumers
explicitly: *"Ticket/customer attachments must not live on local disk or
in the database."* `ticket-attachments/00-overview.md` (Story 66)
deliberately built only the Ticket side first — *"Customer-level
attachments (the domain table's other named consumer — deferred to its own
follow-up story once this module exists to extend, mirroring exactly how
Customer Portal (52) followed KB Foundation (51) as a separate story)"* —
and that module (`AttachmentsModule`/`S3StorageService`, MinIO running,
bucket created) now exists. This is that named follow-up.

## Recon — why this and not something else

- **AI Services, Communication/Channels, Integrations**: still genuinely
  blocked — see prior Recon sections (`knowledge-base-article-versioning/
  00-overview.md`, `ticket-attachments/00-overview.md`) for the full,
  unchanged reasoning.
- **Reporting & Analytics**: already covers every named dimension.
- **Knowledge Base**: both disclosed Story 51 gaps are closed.
- **Customer Attachments**: the only remaining piece of a domain this
  session already started (Story 66), explicitly pre-planned as its own
  follow-up rather than scope-creeped into Story 66, no external blocker,
  reuses the exact same `S3StorageService`/bucket/size-and-MIME-limit
  infrastructure already built and verified against real MinIO. Selected.

## Scope

- One new `CustomerAttachment` model (`customers` schema) — mirrors
  `TicketAttachment`'s exact shape (a direct `customerId` FK, not a
  retrofit of `TicketAttachment` into a polymorphic entity-type table,
  which Story 66 deliberately avoided and this story keeps avoiding for
  the same reason: no existing precedent for polymorphic entity tables
  anywhere in this schema).
- `AttachmentsService` gains `uploadCustomerAttachment`/
  `listCustomerAttachments`/`getCustomerAttachmentDownloadUrl`, mirroring
  its own ticket-side methods exactly (same size/MIME validation, same
  presigned-URL-as-JSON download shape Story 66 already established and
  verified).
- A new `CustomerAttachmentsController`, in the same `AttachmentsModule`
  (mirrors `NotificationsModule` already hosting two distinct controllers
  — `NotificationPreferencesController`/`NotificationTemplatesController`
  — over one shared service/module), mounted at
  `customers/:id/attachments`, reusing `customer:read`/`customer:update`
  (no new permission).
- Customer Workspace detail view gets the same "Attachments" card shape
  Story 66 already built for tickets.

**Not in scope**: everything Story 66 already deferred (deletion, content
scanning, presigned-PUT direct upload, thumbnails, re-upload versioning,
non-MinIO production provisioning) — unchanged for the customer side too.

## Dependencies

- `ticket-attachments` (Story 66): `AttachmentsModule`, `S3StorageService`,
  `attachment-limits.ts` — all reused unchanged, not duplicated.
