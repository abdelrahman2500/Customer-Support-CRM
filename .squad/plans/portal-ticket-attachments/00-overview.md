# portal-ticket-attachments — plan overview

Entry point for the **portal-ticket-attachments** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 103 | [103-story-portal-ticket-attachments.md](./103-story-portal-ticket-attachments.md) | Customer Portal — Ticket Attachment Upload | — | `ticket-attachments-foundation` Story 66, `customer-attachments` Story 67, `customer-portal-submit-and-track-tickets` Story 53, `customer-portal-live-chat` Story 77 |

## Dependency notes

- Selected via a fresh, whole-repository Recon performed after Stories
  99-102 closed (CLAUDE.md §8) — dispatched as a read-only Explore pass
  covering every domain in `docs/architecture/03-domain-boundaries.md`,
  not just the reporting/identity/customer/KB threads Stories 99-102 had
  been working through.
- **The gap**: `apps/api/src/modules/attachments/attachments.controller.ts`
  (`POST/GET tickets/:id/attachments`, `GET .../download`) and
  `customer-attachments.controller.ts` are fully built for the agent app
  (Stories 66/67), backed by a working `S3StorageService`/pre-signed-URL
  flow. But `apps/api/src/modules/portal/portal-tickets.controller.ts` —
  the entire customer-facing ticket surface (create/list/get/history/
  csat/messages) — has no attachment route at all, and no
  `PortalAttachmentsController`/portal attachment method exists anywhere.
  A customer can submit a ticket and reply via Live Chat (Story 77) but
  cannot attach a screenshot or document, while the agent replying on the
  other side of the same conversation already can (Story 66).
- **Why not externally blocked**: object storage (MinIO/S3-compatible) is
  an already-resolved, already-implemented decision
  (`03-domain-boundaries.md`: "Binary content is in object storage";
  proven live by two prior stories) — nothing here depends on email/SMS/
  WhatsApp/ERP, the domains CLAUDE.md §2 keeps correctly deferred.
- **Dependency correctness**: builds only on infrastructure already fully
  in place — `AttachmentsService`/`S3StorageService` (Stories 66/67) and
  `PortalTicketsService`'s existing `PortalService.getAuthenticatedContact`
  + `TicketsService`-composition pattern (Stories 53/77/85, most directly
  `TicketChannelService.createCustomerMessage`'s "resolve customerId, then
  call the ticket-owning check" shape).
- **Architectural coherence, with one necessary schema change**:
  `TicketAttachment.uploadedByUserId` is currently a *required* `User`
  reference — there is no way to record a *Contact* as an attachment's
  uploader today. This mirrors exactly the problem `ChannelMessage`
  already solved (`senderContactId String?` + `senderUserId String?`,
  both nullable, exactly one populated) — `TicketAttachment` gains the
  identical shape (`uploadedByContactId` alongside a now-nullable
  `uploadedByUserId`), not a new polymorphic table.
- **Product value**: closes a concrete, easily-demonstrated functional
  parity gap in the core self-service flow the Full CRM Vision describes.
- **Risk reduction**: near-zero — reuses infrastructure already exercised
  by two prior, passing e2e suites.
- **Smallness**: one additive schema change (mirroring an existing
  pattern) + new methods on two already-existing services + three new
  routes on an already-existing controller + a portal-only frontend
  addition (agent app is untouched — it already has attachment UI).
