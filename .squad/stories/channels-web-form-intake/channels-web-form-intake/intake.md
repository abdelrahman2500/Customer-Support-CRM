> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/channels-web-form-intake/channels-web-form-intake/intake.md`

---

## Feature

- **Feature name (display):** Communication / Channels
- **Feature slug (folder under `plans/`):** `channels-web-form-intake`

## Title

```text
Story 87 — Communication/Channels: Public Web-Form Ticket Intake
```

## Description

```text
docs/architecture/06-communication-and-realtime.md names five channels
(email, WhatsApp, SMS, live chat, web forms); only live chat (Story 77)
and AI chat (Story 85) have ever had a real ChannelMessage producer.
ChannelType.WEB_FORM has existed in the Prisma enum since Story 77's own
migration and is explicitly flagged as unimplemented in that story's and
Story 85's plan docs. Unlike email/WhatsApp/SMS, a web form needs no
third-party provider decision — it is a self-hosted, public, rate-limited
API endpoint per the architecture's own description. This story builds
it: POST /api/v1/channels/web-form, unauthenticated, rate-limited tighter
than the global default, which finds-or-creates a Customer/Contact by
(branchId, email), creates a Ticket via the existing
TicketsService.createTicketForContact path, and records the submitted
message as an inbound WEB_FORM ChannelMessage — the first real producer
for that channel type.
```

## Acceptance criteria

```text
- [ ] POST /api/v1/channels/web-form is @Public(), validates its DTO
      (branchId, fullName, email, phone?, subject, category?, message),
      and is throttled tighter than the global default (@Throttle).
- [ ] CustomersService.findOrCreateContactForWebForm(branchId, {fullName,
      email, phone}) finds an existing Contact by (branchId, email)
      across every Customer in that branch, or creates a new Customer +
      Contact when none exists; throws NotFoundException for an
      unknown/inactive branchId.
- [ ] The endpoint creates a Ticket via TicketsService.
      createTicketForContact (unchanged) for the resolved contactId, then
      records the submitted message via a new
      TicketChannelService.recordWebFormMessage using channelType
      "WEB_FORM", direction INBOUND, senderContactId set.
- [ ] The created ticket and its WEB_FORM message are visible to agents
      via every existing endpoint (GET /tickets, GET /tickets/:id/
      messages, realtime ticket:{id}) with no new agent-facing surface.
- [ ] New unit tests cover: CustomersService.findOrCreateContactForWebForm
      (new-record path, reuse path, cross-branch isolation, unknown/
      inactive branch); TicketChannelService.recordWebFormMessage; the
      new WebFormIntakeService's orchestration.
- [ ] New e2e coverage (apps/api/test/channels-web-form.e2e-spec.ts):
      missing-field validation (400), unknown branchId (404), a full
      create-and-verify-as-agent flow, same-email reuse across two
      submissions, and the route's own rate limit (429).
- [ ] Typecheck, lint, build, and apps/api's unit + this story's e2e
      coverage pass.
```

## Dependencies

- Story 07/08/53 — `ticketing` (`TicketsService.createTicketForContact`).
- Story 06 — `customer-management` (`CustomersService`, `Contact`/
  `Customer` models).
- Story 77/85 — `customer-portal-live-chat` /
  `ai-chat-escalation-to-ticket` (`ChannelsModule`, `ChannelMessagesService.
  createInboundFromContact`, `ChannelType.WEB_FORM`, `TicketChannelService`'s
  "no authorization of its own for a ticket the caller just created"
  precedent).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any frontend widget or page in `apps/web`/`apps/portal`.
- A public branch-picker/listing endpoint — `branchId` is client-supplied.
- CAPTCHA or spam-scoring beyond the route's own rate limit.
- Attachment support on the initial submission.
- An `EMAIL`/`WHATSAPP`/`SMS` producer — still blocked on an unresolved
  external-provider decision.
- Any Customer Portal account/credential creation for the new Contact.
