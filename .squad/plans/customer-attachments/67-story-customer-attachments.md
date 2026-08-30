# Story 67 — Customer Attachments (Foundation)

## Prerequisites

- `ticket-attachments` (Story 66): `AttachmentsModule`, `S3StorageService`
  (bucket already created, verified against real MinIO),
  `attachment-limits.ts`.

---

## Story Goal

Let an agent attach a file to a Customer profile and download it back —
the second, previously-deferred named consumer of
docs/architecture/01-technology-stack.md's *"Ticket/customer
attachments"*, reusing Story 66's infrastructure unchanged.

**Not in scope**: everything Story 66 already deferred for tickets
(deletion, content/virus scanning, presigned-PUT direct upload,
thumbnails/previews, re-upload versioning, non-MinIO production
provisioning) — identically out of scope here.

---

## Context — Read These Files First

1. `apps/api/src/modules/attachments/attachments.service.ts` — the exact
   ticket-side methods (`uploadAttachment`/`listAttachments`/
   `getDownloadUrl`) this story's new customer-side methods mirror
   field-for-field.
2. `apps/api/src/modules/attachments/attachments.controller.ts` — the
   exact route/permission/`FileInterceptor` shape the new
   `CustomerAttachmentsController` mirrors.
3. `apps/api/src/modules/attachments/s3-storage.service.ts`/
   `attachment-limits.ts` — reused unchanged, no edits.
4. `apps/web/src/components/tickets/ticket-detail-view.tsx`'s
   `AttachmentsCard`/`AddAttachmentForm` — the exact JSX/hook shape mirrored
   for `CustomerDetailView`.

---

## Design decisions

1. **A new, separate `CustomerAttachment` model**, not a retrofit of
   `TicketAttachment` into a polymorphic entity-type table — same
   reasoning Story 66 already documented (no existing precedent for
   polymorphic entity tables anywhere in this schema). Identical shape:
   `id`, `customerId` FK (cascade delete), `key` (unique), `filename`,
   `size`, `mimeType`, `uploadedByUserId`, `createdAt`.
2. **`AttachmentsService` gains three new methods**, not a new service —
   it already owns `S3StorageService` and the size/MIME validation logic;
   splitting into two services would duplicate that validation for no
   benefit. Scoping mirrors `findTicketInScope` exactly, via a new private
   `findCustomerInScope`.
3. **A new `CustomerAttachmentsController`**, registered in the same
   `AttachmentsModule` — mirrors `NotificationsModule`'s own established
   precedent of hosting two distinct controllers over one shared module.
   Mounted at `customers/:id/attachments`. `customer:update` gates upload,
   `customer:read` gates list/download — no new permission.
4. **Download stays the exact same "JSON body with the presigned URL,
   never a redirect" shape** Story 66 already built and the frontend
   already knows how to consume (`getAttachmentDownloadUrl` becomes
   parametrized by owner type, not duplicated).
5. **Frontend: the exact same `AttachmentsCard`/`AddAttachmentForm` shape**
   Story 66 built for tickets, parametrized to a generic "owner"
   (`ticketId` or `customerId`) rather than copy-pasted twice — the API
   client/hook layer gains one additional parameter (owner kind + id)
   rather than two near-duplicate files, since the request/response shapes
   are otherwise identical.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — new `CustomerAttachment` model;
   reverse relation on `Customer`.
2. **Migration** — `add_customer_attachments`.
3. **`apps/api/src/modules/attachments/attachments.service.ts`** —
   `uploadCustomerAttachment`/`listCustomerAttachments`/
   `getCustomerAttachmentDownloadUrl`, mirroring the ticket-side methods;
   `findCustomerInScope`.
4. **`apps/api/src/modules/attachments/customer-attachments.controller.ts`**
   — new controller, `customers/:id/attachments`.
5. **`apps/api/src/modules/attachments/attachments.module.ts`** — registers
   the new controller.
6. **Tests** — see Test Plan.

### Frontend

7. **`apps/web/src/lib/attachments-api.ts`** — generalize to accept an
   `ownerType: "ticket" | "customer"` + `ownerId`, building
   `/tickets/:id/attachments` or `/customers/:id/attachments` accordingly;
   every existing ticket call site updated to pass `"ticket"` explicitly
   (no behavior change).
8. **`apps/web/src/hooks/use-attachments.ts`** — same generalization for
   the query key/hooks.
9. **`apps/web/src/components/tickets/ticket-detail-view.tsx`** —
   `AttachmentsCard`/`AddAttachmentForm` become shared, parametrized
   components (moved to their own file so `CustomerDetailView` can import
   them too, rather than duplicating the JSX).
10. **`apps/web/src/components/customers/customer-detail-view.tsx`** — a
    new Attachments card, reusing the shared component.
11. **i18n** — `apps/web/messages/{en,ar}.json`: reuse
    `tickets.detail.attachments*` strings via a shared `attachments`
    namespace both `tickets`/`customers` translation trees reference, OR a
    small `customers.detail.attachments*` set mirroring the existing
    `tickets.detail.attachments*` strings verbatim if next-intl namespace
    sharing proves awkward — decided during implementation, whichever
    keeps every existing key unchanged.
12. **Tests** — see Test Plan.

---

## API contract

- `POST /customers/:id/attachments` — `customer:update` — identical
  contract to `POST /tickets/:id/attachments`.
- `GET /customers/:id/attachments` — `customer:read` — identical contract.
- `GET /customers/:id/attachments/:attachmentId/download` — `customer:read`
  — identical contract (JSON `{ url }`).

## Tests

**Backend unit** (extend `attachments.service.spec.ts`): the three new
customer-side methods, mirroring every existing ticket-side test
(size/MIME rejection before any S3 call, server-generated key, 404 for an
unknown/cross-branch customer id).

**Backend e2e** (extend `attachments.e2e-spec.ts` or a new
`customer-attachments.e2e-spec.ts`, real MinIO): upload → list → download
round trip with byte verification, mirroring the ticket-side suite exactly;
404s; an Agent-role user without `customer:update`/`customer:read` gets
403.

**Frontend component**: the shared `AttachmentsCard` gets tests parametrized
by owner type (or reuses the exact `TicketDetailView` tests' shape for
`CustomerDetailView`); every pre-existing `CustomerDetailView`/
`TicketDetailView` test passes unmodified.

## Regression requirements

Every existing test suite remains green, unweakened — especially every
pre-existing ticket-attachment test (Story 66), unmodified in behavior.

## Migration requirements

One new migration, additive only.

## Security risks/mitigations

Identical to Story 66 — reused validation/presigned-URL/branch-scoping
logic, not reimplemented.

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

- [ ] `POST/GET /customers/:id/attachments` and
      `GET /customers/:id/attachments/:attachmentId/download` work
      identically to their ticket-side counterparts.
- [ ] Customer Workspace detail view shows a working Attachments card.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test (including
      every Story 66 ticket-attachment test) remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short`
      clean before commit.

---

## Non-Goals (explicit)

- Everything Story 66 already deferred (deletion, content/virus scanning,
  presigned-PUT direct upload, thumbnails/previews, re-upload versioning,
  non-MinIO production provisioning).
- Any README change.
