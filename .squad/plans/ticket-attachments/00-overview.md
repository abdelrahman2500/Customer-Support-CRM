# Feature overview — Ticket Attachments (Foundation)

## Why this feature, why now

`docs/architecture/03-domain-boundaries.md`'s domain table names "attachment
metadata" as owned scope under Customer Management ("Customer profiles,
contacts, interaction history, attachment metadata... Binary content is in
object storage"). `docs/architecture/04-data-and-multitenancy.md` is
explicit about the intended shape: *"Attachment binaries live in
S3-compatible object storage; Postgres stores key, filename, size, MIME
type, and owning entity metadata."* `docs/architecture/01-technology-stack.md`
names the concrete local/dev backing service: *"S3-compatible (MinIO for
local/dev...)"*. None of this exists anywhere in the codebase today (no
`Attachment`-shaped model, no S3 client, no upload/download route) — this
is a real, fully-unimplemented, explicitly-documented v1 gap, not an
invented one.

## Recon — why this and not something else

- **AI Services, Communication/Channels, Integrations**: still genuinely
  blocked — see `knowledge-base-article-versioning/00-overview.md`'s own
  Recon section for the full reasoning (no working Anthropic credential in
  this repo beyond squad-kit's own unrelated tooling token; no email/SMS/
  WhatsApp/ERP vendor decision exists anywhere in the repository).
- **Reporting & Analytics**: already covers every named dimension (ticket
  volume/SLA/CSAT — Story 56; agent performance — Story 59; ticket aging —
  Story 60). A further Reporting story would invent an undocumented
  dimension.
- **Knowledge Base**: both disclosed Story 51 gaps (search, versioning) are
  now closed (Stories 64, 65).
- **Attachments**: unlike Channels/AI/Integrations, this domain's backing
  service is **not** an external vendor decision — `docker-compose.yml`
  already defines a `minio` service (image `minio/minio:latest`, with the
  exact `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET` values
  already present, unused, in `apps/api/.env` and already scaffolded as
  optional env-schema entries in `env.validation.ts`). It was simply never
  started. Starting it (`docker compose up -d minio`) and creating its
  bucket are the same class of one-time local-dev setup as this
  repository's own already-running Postgres/Redis containers — not a
  vendor/credential decision requiring external input. Selected.

## Scope

A **foundation** slice, mirroring Story 51/56's own restraint: give the
domain a real first consumer rather than adding schema nothing uses yet.

- One new `TicketAttachment` model (`customers` schema, per the domain
  table's explicit ownership — a direct `ticketId` FK, mirroring this
  codebase's existing `TicketNote`/`TicketCsatResponse`/`SlaEscalation`
  precedent of a plain FK, never a polymorphic entity-type table this
  codebase has no prior example of).
- Upload a file to a ticket (`POST /tickets/:id/attachments`,
  `multipart/form-data`, buffered through the API to S3 — not a
  presigned-PUT direct-to-S3 flow, which would need its own frontend
  upload-progress/two-step design not evidenced anywhere in this codebase
  yet); list a ticket's attachments; download one via a short-lived
  presigned S3 GET URL (the API redirects, never proxies the binary
  itself).
- Agent Workspace ticket detail view gets an "Attachments" section: list
  with download links + a file input for upload.

**Not in scope**: Customer-level attachments (the domain table's other
named consumer — deferred to its own follow-up story once this module
exists to extend, mirroring exactly how Customer Portal (52) followed KB
Foundation (51) as a separate story); attachment deletion; file
type/content scanning (only a size cap and a small MIME allow-list);
direct-to-S3 presigned-PUT upload; thumbnails/previews; versioning of a
re-uploaded file with the same name; production S3/Azure Blob credential
provisioning (only MinIO local/dev is exercised — the S3 API surface is
provider-agnostic per the architecture doc's own stated rationale, so no
code changes are needed for a future real-AWS/Azure swap, only different
env values).

## Dependencies

None — `TicketAttachment` FKs into `Ticket` (already exists), and this
story's own new S3 client wrapper has no other in-repo consumer yet.
