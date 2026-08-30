# Story 66 — Ticket Attachments (Foundation)

## Prerequisites

- `Ticket` model exists (`ticketing` schema).
- `docker-compose.yml`'s `minio` service and `apps/api/.env`'s
  `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET` (already
  present, unused, since project foundation) — started and bucket created
  as part of this story's own setup.

---

## Story Goal

Let an agent attach a file to a ticket and download it back, backed by
S3-compatible object storage (MinIO locally), closing the gap
`docs/architecture/04-data-and-multitenancy.md` names directly:
*"Attachment binaries live in S3-compatible object storage; Postgres
stores key, filename, size, MIME type, and owning entity metadata."*

**Not in scope**: Customer-level attachments (deferred follow-up, see plan
overview); deletion; content/virus scanning; presigned-PUT direct-to-S3
upload; thumbnails/previews; re-upload versioning; a non-MinIO production
provider (same S3 API, no code change needed, only env values).

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `Ticket` model (the exact FK target)
   and `TicketNote`/`TicketCsatResponse` (the exact "plain FK into Ticket,
   no polymorphic entity-type table" shape this story's own model mirrors).
2. `apps/api/src/modules/tickets/tickets.controller.ts`/`tickets.service.ts`
   — the exact route/permission/branch-scope conventions
   (`RequirePermissions`, `findTicketInScope`) this story's new routes
   mirror; `getCsat`'s `@Res()` non-passthrough pattern (not needed here,
   since every new route has a normal JSON/redirect response, but confirms
   the existing precedent for a non-standard response).
3. `apps/api/src/common/config/env.validation.ts` — the existing (currently
   unused-anywhere) `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET`
   optional entries this story makes required and finally consumes.
4. `docker-compose.yml` — the existing (currently never-started) `minio`
   service definition.
5. `apps/web/src/components/tickets/ticket-detail-view.tsx` — the exact
   detail view an "Attachments" section is appended to, mirroring how the
   CSAT section (Story 55) and Notes section were each appended previously.

---

## Design decisions

1. **One new `TicketAttachment` model, `customers` schema** (per the domain
   table's explicit "attachment metadata" ownership under Customer
   Management), with a direct `ticketId` FK into `Ticket` — not a
   polymorphic `entityType`/`entityId` pair, which this codebase has no
   existing precedent for anywhere (`TicketNote`, `TicketCsatResponse`,
   `SlaEscalation` are all plain single-parent FKs). Fields: `id`,
   `ticketId`, `key` (the S3 object key, unique), `filename`, `size` (Int,
   bytes), `mimeType`, `uploadedByUserId` (`User`, `identity` schema),
   `createdAt`. Cross-schema FKs already exist elsewhere in this schema
   (e.g. `KnowledgeBaseArticle.branchId` → `Branch`), so this is not a new
   pattern.
2. **A new top-level `AttachmentsModule`/`AttachmentsService`/
   `AttachmentsController`**, not folded into `CustomersModule` or
   `TicketsModule` — mirrors this codebase's own one-module-per-concern
   convention (e.g. `NotificationTemplatesController` living alongside, but
   distinct from, `NotificationPreferencesController` inside one shared
   `NotificationsModule` registration — here, similarly, `Attachments` is
   registered as its own module even though it shares the `customers`
   Postgres schema, since it is conceptually and operationally distinct
   from customer/contact CRUD). Branch/existence scoping for the parent
   ticket is a direct `this.prisma.ticket.findFirst({ where: { id,
   branchId } })` read — mirrors `TicketCsatResponse`'s own disclosed
   "scoped through the Ticket relation" convention and `ReportingService`'s
   own precedent of reading another domain's Prisma models directly for a
   read/existence check, not importing `TicketsService` cross-module
   (avoiding a circular module-import risk between `TicketsModule` and this
   new module).
3. **Upload is buffered through the API (`multipart/form-data`,
   `FileInterceptor`), not a presigned-PUT direct-to-S3 flow.** A direct-to-
   S3 flow needs its own two-step (presign → client PUT → confirm) design
   this codebase has no precedent for and which is unwarranted for a
   foundation slice's expected file sizes; a `10 MB` size cap and a small
   MIME allow-list (images, PDF, plain text, common office formats) are
   enforced before any S3 call.
4. **Download is a presigned, short-lived (15-minute) S3 GET URL the API
   returns and the browser follows** — never proxying the binary through
   the API process it(keeps the API stateless/lightweight for large
   files, the standard S3-backed pattern the architecture doc's own
   rationale for choosing S3 already implies).
5. **The S3 client wrapper ensures its bucket exists on module init**
   (`HeadBucket`, then `CreateBucket` if missing) — idempotent and safe to
   run in any freshly-provisioned environment (mirrors this codebase's own
   "`prisma:seed` is safe and idempotent" precedent), rather than relying
   on a manual one-time `mc mb` step every environment must remember.
6. **No new permission key** — `ticket:update` gates upload (a mutation),
   `ticket:read` gates list/download (mirrors every other ticket sub-
   resource's exact permission mapping, e.g. `createNote`/`getNotes`).
7. **`S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET` become
   required**, not optional, in `env.validation.ts` — this story is their
   first real consumer, mirroring how every other previously-optional,
   now-consumed config value in this codebase became required at the
   moment of its first real use.

---

## Implementation Tasks

### Backend

1. **`docker-compose.yml`** — already defines `minio`; start it and create
   the `crm-attachments` bucket as part of this story's own setup (the
   application also self-heals this on module init, Design item 5).
2. **`apps/api/package.json`** — add `@aws-sdk/client-s3`,
   `@aws-sdk/s3-request-presigner`, `@types/multer` (dev).
3. **`apps/api/src/common/config/env.validation.ts`** — drop `.optional()`
   from the four `S3_*` keys.
4. **`apps/api/prisma/schema.prisma`** — new `TicketAttachment` model.
5. **Migration** — `add_ticket_attachments`.
6. **`apps/api/src/modules/attachments/s3-storage.service.ts`** — thin
   wrapper: `ensureBucketExists()` (called from `onModuleInit`),
   `uploadObject(key, body, mimeType)`, `getPresignedDownloadUrl(key)`.
7. **`apps/api/src/modules/attachments/attachments.service.ts`** —
   `uploadAttachment(ticketId, file)` (branch-scope check, size/MIME
   validation, S3 upload, DB row), `listAttachments(ticketId)`,
   `getDownloadUrl(ticketId, attachmentId)`.
8. **`apps/api/src/modules/attachments/attachments.controller.ts`** —
   `POST /tickets/:id/attachments` (`FileInterceptor("file")`,
   `ticket:update`), `GET /tickets/:id/attachments` (`ticket:read`),
   `GET /tickets/:id/attachments/:attachmentId/download` (`ticket:read`,
   `@Res()` 302 redirect to the presigned URL).
9. **`apps/api/src/modules/attachments/attachments.module.ts`** — registers
   the above; imported by `AppModule`.
10. **Tests** — see Test Plan.

### Frontend

11. **`apps/web/src/lib/attachments-api.ts`** — `AttachmentSummary` type;
    `listAttachments(ticketId)`; `uploadAttachment(ticketId, file)` (posts
    `FormData`, not JSON — a new shape for `apiFetch`, so a small dedicated
    `fetch` call bypassing the JSON-only helper, mirroring how this
    codebase already keeps a distinct API-client file per domain);
    `getAttachmentDownloadUrl(ticketId, attachmentId)`.
12. **`apps/web/src/hooks/use-attachments.ts`** — `attachmentsQueryKey(ticketId)`,
    `useAttachmentsQuery(ticketId)`, `useUploadAttachmentMutation(ticketId)`
    (never-optimistic, invalidates the list on success).
13. **`apps/web/src/components/tickets/ticket-detail-view.tsx`** — a new
    "Attachments" section: list with filename/size/download-link rows, a
    file input + upload button, loading/error/empty states mirroring the
    view's own existing sections (CSAT, Notes).
14. **i18n** — `apps/web/messages/{en,ar}.json`:
    `tickets.detail.attachments.title`/`empty`/`error`/`uploadButton`/
    `uploading`/`uploadFailed`/`download`/`tooLarge`/`unsupportedType`.
15. **Tests** — see Test Plan.

---

## API contract

- `POST /tickets/:id/attachments` — `ticket:update`, `multipart/form-data`
  field `file` — `201` with the created attachment summary; `400` for an
  oversized file or disallowed MIME type; `404` for an unknown/cross-branch
  ticket id.
- `GET /tickets/:id/attachments` — `ticket:read` — `200` with `[]` for a
  ticket with none; `404` for an unknown/cross-branch ticket id.
- `GET /tickets/:id/attachments/:attachmentId/download` — `ticket:read` —
  `302` redirect to a presigned S3 URL; `404` for an unknown attachment,
  wrong ticket, or unknown/cross-branch ticket id.

## Tests

**Backend unit** (`attachments.service.spec.ts`, mocked Prisma + a mocked
`S3StorageService`): uploads within the size/MIME limits create a DB row
and call the S3 wrapper with the right key/body; an oversized file or a
disallowed MIME type is rejected before any S3 call; `listAttachments`/
`getDownloadUrl` throw `NotFoundException` for an unknown/cross-branch
ticket id, mirroring `findTicketInScope`'s own existing tests elsewhere.

**Backend e2e** (`attachments.e2e-spec.ts`, real MinIO — the same "bootstrap
the real `AppModule` against real infra" convention every other e2e suite
already follows for Postgres/Redis): upload a small real file to a real
ticket, list it back, follow the presigned download URL and confirm the
downloaded bytes match what was uploaded; oversized/disallowed-type
rejection; 404s for an unknown/cross-branch ticket id; an Agent-role user
without `ticket:update`/`ticket:read` gets 403 (only if such a restricted
role exists in seed — otherwise this assertion is skipped with the same
disclosure convention already used elsewhere when a scenario has no
existing negative-permission fixture).

**Frontend component**: attachment list renders, upload wiring, size/type
client-side validation messaging, loading/error/empty states; every
pre-existing `TicketDetailView` test passes unmodified.

## Regression requirements

Every existing test suite remains green, unweakened.

## Migration requirements

One new migration, additive only (`CREATE TABLE`, no changes to `tickets`).

## Security risks/mitigations

- **Size/MIME allow-list enforced server-side**, not just client-side —
  never trust the browser.
- **Presigned URLs are short-lived (15 minutes)** and scoped to a single
  object key — never a long-lived or bucket-wide credential exposed to the
  browser.
- **Branch scoping unchanged**: every route re-validates the parent
  ticket's branch scope exactly like every other ticket sub-resource.
- **No path/key injection**: the S3 object key is a server-generated UUID,
  never derived from the client-supplied filename.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `POST /tickets/:id/attachments` uploads a real file to MinIO and
      records its metadata; oversized/disallowed-type files are rejected.
- [ ] `GET /tickets/:id/attachments` lists a ticket's attachments.
- [ ] `GET /tickets/:id/attachments/:attachmentId/download` redirects to a
      working presigned URL that returns the original bytes.
- [ ] Agent Workspace ticket detail view shows a working Attachments
      section.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains
      green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short`
      clean before commit.

---

## Non-Goals (explicit)

- Customer-level attachments (a separate, deferred follow-up story).
- Attachment deletion, content/virus scanning, presigned-PUT direct upload,
  thumbnails/previews, re-upload versioning.
- Any non-MinIO production object-storage provisioning.
- Any README change.
