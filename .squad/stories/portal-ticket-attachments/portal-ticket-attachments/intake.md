> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/portal-ticket-attachments/portal-ticket-attachments/intake.md`

---

## Feature

- **Feature name (display):** Customer Portal — Ticket Attachment Upload
- **Feature slug (folder under `plans/`):** `portal-ticket-attachments`

## Title

```text
Story 103 — Customer Portal: Ticket Attachment Upload
```

## Description

```text
The agent-facing ticket attachment surface (Stories 66/67) and the
portal's own Live Chat (Story 77) both exist, but a portal contact
cannot attach a file to their own ticket - PortalTicketsController has
no attachment route. This story adds it, reusing AttachmentsService/
S3StorageService exactly as-is, after widening TicketAttachment to allow
a Contact as uploader (mirroring ChannelMessage's existing nullable
senderContactId/senderUserId pair).
```

## Acceptance criteria

```text
- [ ] TicketAttachment.uploadedByUserId nullable; new
      uploadedByContactId, nullable, FK to Contact.
- [ ] AttachmentsService gains uploadAttachmentForCustomer/
      listAttachmentsForCustomer/getDownloadUrlForCustomer, scoped via a
      new findTicketInCustomerScope(ticketId, customerId) check.
      AttachmentSummary gains uploadedByContactId; uploadedByUserId
      becomes nullable.
- [ ] AttachmentsModule exports AttachmentsService; PortalModule imports
      AttachmentsModule.
- [ ] PortalTicketsService gains uploadAttachment/listAttachments/
      getAttachmentDownloadUrl, resolving customerId via
      PortalService.getAuthenticatedContact first (mirrors sendMessage).
- [ ] PortalTicketsController gains POST/GET :id/attachments and
      GET :id/attachments/:attachmentId/download, all @PortalRoute().
- [ ] apps/portal: attachments-api.ts, use-portal-attachments.ts, a
      TicketAttachmentsCard wired into ticket-detail-view.tsx.
- [ ] An attachment uploaded by a contact is visible via the existing
      agent-side GET /tickets/:id/attachments, and vice versa.
- [ ] A contact cannot reach another customer's ticket's attachments
      (404).
- [ ] Existing agent-side attachment tests (Stories 66/67) pass
      unmodified.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or
      its documented isolated-file fallback), pnpm --filter @crm/portal
      test, pnpm typecheck, pnpm lint, and pnpm build all pass.
```

## Dependencies

- Story 66 — `AttachmentsService`/`AttachmentsController`/`S3StorageService`.
- Story 67 — `CustomerAttachment` (the "same service, second consumer" precedent).
- Story 53 — `PortalTicketsService`/`PortalTicketsController`.
- Story 77 — `TicketChannelService.createCustomerMessage`'s composition shape.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Customer-level (`CustomerAttachment`) portal access — agent-only,
  unchanged.
- Any change to the agent-facing attachment routes/permissions.
- A new S3 bucket/CORS policy/presigned-URL mechanism.
- Attachments on individual Live Chat messages.
