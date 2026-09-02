# Story 103 — Customer Portal: Ticket Attachment Upload

## Prerequisites

- Story 66 — `AttachmentsService`/`AttachmentsController`/`S3StorageService`,
  `attachment-limits.ts` (size/MIME allow-list).
- Story 67 — `CustomerAttachment`/`CustomerAttachmentsController` (the
  "same service, second consumer" precedent this story extends a third
  way).
- Story 53 — `PortalTicketsService`/`PortalTicketsController`,
  `PortalService.getAuthenticatedContact`.
- Story 77 — `TicketChannelService.createCustomerMessage`'s "resolve
  `customerId`, then check ticket ownership" composition shape, the exact
  pattern this story's new attachment methods mirror.

All are complete and already merged to `main`.

## Story Goal

Let a Customer Portal contact upload, list, and download attachments on
their own tickets — the one asymmetry left in an otherwise two-way
ticket conversation (agents already can via Story 66; contacts already
can send/receive Live Chat messages via Story 77).

## Non-Goals

- **No customer-level attachments for portal contacts.** Story 67's
  `CustomerAttachment` stays an agent-only concept (attaching a document
  to the *customer account* itself, e.g. a signed contract) — out of
  scope here, which is specifically about *ticket* attachments.
- **No change to the agent-facing `AttachmentsController`/
  `CustomerAttachmentsController` routes or their `ticket:update`/
  `customer:update` permission gates.** An agent already sees every
  attachment on a ticket regardless of who uploaded it — `listAttachments`
  is untouched.
- **No new S3 bucket, CORS policy, or presigned-URL mechanism.** Reuses
  `S3StorageService` exactly as-is.
- **No change to `attachment-limits.ts`'s size/MIME allow-list** — the
  same limits apply to a customer-uploaded file as an agent-uploaded one.
- **No attachments on Live Chat messages themselves** (`ChannelMessage`
  has no attachment relation) — a ticket-level attachment list, exactly
  like the agent side.

## Design decisions

1. **Schema**: `TicketAttachment.uploadedByUserId` becomes nullable;
   `TicketAttachment` gains `uploadedByContactId String? @map(
   "uploaded_by_contact_id")` + `uploadedByContact Contact? @relation(...)`.
   Mirrors `ChannelMessage.senderContactId`/`senderUserId`'s exact
   nullable-pair shape — exactly one is ever populated (enforced by
   which service method is called, not a DB constraint, matching
   `ChannelMessagesService.createOutboundFromUser`/`createInboundFromContact`'s
   own precedent of no DB-level XOR check).

2. **`AttachmentsService`** gains three customer-scoped methods, mirroring
   the existing ticket-side ones exactly except for the ownership check
   and the FK set on create:
   - `findTicketInCustomerScope(ticketId, customerId)` — a new private
     helper, `this.prisma.ticket.findFirst({ where: { id, customerId } })`,
     mirroring `TicketsService.findTicketInCustomerScope`'s own identical
     shape (not importing `TicketsService` itself — this service already
     deliberately avoids that import, per its own existing doc comment,
     to sidestep a module dependency it doesn't otherwise need).
   - `uploadAttachmentForCustomer(ticketId, customerId, contactId, file)`
     — same `validateFile`/server-generated-key/`s3Storage.uploadObject`
     steps as `uploadAttachment`, `data: { ..., uploadedByContactId:
     contactId }` (no `uploadedByUserId`).
   - `listAttachmentsForCustomer(ticketId, customerId)`,
     `getDownloadUrlForCustomer(ticketId, customerId, attachmentId)` —
     identical to the agent-side reads, scoped by the new check.
   - `AttachmentSummary` gains `uploadedByUserId: string | null` (was
     `string`) and `uploadedByContactId: string | null`.
   - `AttachmentsModule` gains `exports: [AttachmentsService]` (currently
     has none) so `PortalModule` can inject it.

3. **`PortalTicketsService`** gains a fourth constructor dependency
   (`AttachmentsService`, from the now-imported `AttachmentsModule`) and
   three methods composing it with `PortalService.getAuthenticatedContact`
   exactly like `sendMessage`/`getMessages` already do:
   ```ts
   async uploadAttachment(contactId: string, ticketId: string, file: UploadedFile) {
     const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
     return this.attachmentsService.uploadAttachmentForCustomer(ticketId, customerId, contactId, file);
   }
   async listAttachments(contactId: string, ticketId: string) {
     const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
     return this.attachmentsService.listAttachmentsForCustomer(ticketId, customerId);
   }
   async getAttachmentDownloadUrl(contactId: string, ticketId: string, attachmentId: string) {
     const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
     return this.attachmentsService.getDownloadUrlForCustomer(ticketId, customerId, attachmentId);
   }
   ```

4. **`PortalTicketsController`** gains three routes on the same
   `portal/tickets/:id` sub-resource pattern as `:id/messages`:
   `POST :id/attachments` (`@ApiConsumes("multipart/form-data")` +
   `FileInterceptor("file")`, mirrors `AttachmentsController.create`
   exactly), `GET :id/attachments`, `GET
   :id/attachments/:attachmentId/download`. All `@PortalRoute()`, no new
   permission concept (Contacts have no role system — Story 52's own
   precedent, unchanged).

5. **Frontend (`apps/portal` only — `apps/web` already has attachment
   UI)**: a new `apps/portal/src/lib/attachments-api.ts` +
   `apps/portal/src/hooks/use-portal-attachments.ts`, mirroring
   `apps/web`'s own `attachments-api.ts`/`use-attachments.ts` shape but
   simplified (no `AttachmentOwner` parameter — the portal only ever
   deals with the caller's own ticket). A new, portal-local
   `AttachmentsCard`-equivalent component (portal and web are separate
   Next.js apps with no shared component package for this), inserted into
   `ticket-detail-view.tsx` next to `TicketChatCard`.

## Files expected to change

**Backend**
- `apps/api/prisma/schema.prisma` — `TicketAttachment` nullable `uploadedByUserId` + new `uploadedByContactId`.
- `apps/api/prisma/migrations/<timestamp>_ticket_attachment_contact_uploader/migration.sql` — generated.
- `apps/api/src/modules/attachments/attachments.service.ts` — new methods, updated `AttachmentSummary`/mapper.
- `apps/api/src/modules/attachments/attachments.service.spec.ts` — new unit tests.
- `apps/api/src/modules/attachments/attachments.module.ts` — `exports:`.
- `apps/api/src/modules/portal/portal.module.ts` — import `AttachmentsModule`.
- `apps/api/src/modules/portal/portal-tickets.service.ts` — new methods.
- `apps/api/src/modules/portal/portal-tickets.service.spec.ts` — new unit tests.
- `apps/api/src/modules/portal/portal-tickets.controller.ts` — new routes.
- `apps/api/test/portal-tickets.e2e-spec.ts` (or a new dedicated file) — new e2e tests.

**Frontend**
- `apps/portal/src/lib/attachments-api.ts` — new.
- `apps/portal/src/hooks/use-portal-attachments.ts` — new.
- `apps/portal/src/components/tickets/ticket-attachments-card.tsx` — new.
- `apps/portal/src/components/tickets/ticket-detail-view.tsx` — wire the new card in.
- New spec files for the above.
- `apps/portal/messages/{en,ar}.json` — new `tickets.detail.attachments*` strings.

## Acceptance / Done Criteria

- A portal contact can upload a file to their own ticket; it appears via
  `GET /portal/tickets/:id/attachments` and is downloadable via a
  presigned URL, same as the agent-side flow.
- The same attachment is visible to an agent via the existing
  `GET /tickets/:id/attachments` (proving the two surfaces share one
  underlying list, not two disconnected ones) and vice versa — an
  agent-uploaded attachment is visible to the portal contact.
- A contact cannot upload/list/download attachments on a ticket belonging
  to a different customer (404, mirroring every other
  `findTicketInCustomerScope`-gated route).
- `AttachmentSummary.uploadedByContactId`/`uploadedByUserId` correctly
  reflect who uploaded each row — never both populated on the same row.
- Existing agent-side attachment tests (Stories 66/67) pass unmodified —
  `uploadedByUserId` still populated exactly as before for an
  agent-initiated upload.
- File size/MIME validation applies identically to a portal upload.

## Verification Plan

- `apps/api prisma:generate`, migrate (`--create-only` + `deploy`, this
  sandbox's established safe two-step per `CLAUDE.md` §5).
- `apps/api` unit: `attachments.service.spec.ts`, `portal-tickets.service.spec.ts` — then the full `pnpm --filter @crm/api test`.
- `apps/api` e2e: new portal-attachment tests, run in isolation first, then a full `pnpm --filter @crm/api test:e2e` sweep (accepting the pre-existing, documented environmental failures — realtime-presence, reporting historical-data date-boundary pollution — as unrelated, per this session's own Story 100/101/102 verification).
- `pnpm --filter @crm/portal test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `git status --short` / `git diff --stat` review before commit.
