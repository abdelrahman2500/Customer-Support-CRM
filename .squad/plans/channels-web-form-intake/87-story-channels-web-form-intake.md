# Story 87 — Communication/Channels: Public Web-Form Ticket Intake

## Prerequisites

- `ticketing` Story 07/08/53 —
  `apps/api/src/modules/tickets/tickets.service.ts`
  (`TicketsService.createTicketForContact`, the existing "customer-scoped,
  no `TenantContext`" ticket-creation path).
- `customer-management` Story 06 —
  `apps/api/src/modules/customers/customers.service.ts` (`CustomersService`,
  `Contact`/`Customer` models, `translateDuplicateEmail`).
- `customer-portal-live-chat` Story 77/85 —
  `apps/api/src/modules/channels/channel-messages.service.ts`
  (`ChannelMessagesService.createInboundFromContact`, already generic over
  `ChannelType`), `apps/api/src/modules/tickets/ticket-channel.service.ts`
  (`TicketChannelService`, the existing "compose `TicketsService` +
  `ChannelMessagesService`, no authorization of its own for a ticket the
  caller just created" pattern — see `recordAiChatTranscript`), the
  `ChannelType.WEB_FORM` enum value (added by Story 77's own migration,
  never used since).
- `common/auth` — `@Public()` (`identity.controller.ts`'s `login`/
  `refresh`/`logout` precedent), `ThrottlerGuard`/`@Throttle` (global
  default registered in `app.module.ts`, no per-route override exists yet
  anywhere in the repository — this story adds the first one).

All are complete and already merged to `main`.

## Story Goal

An unauthenticated visitor (a prospect, or an existing customer who has no
Customer Portal account) can submit a support request through a public,
rate-limited HTTP endpoint — the "Web forms use a public, rate-limited API
endpoint" channel `docs/architecture/06-communication-and-realtime.md`
already names but that has never been built. Submitting:

1. finds or creates a `Customer`/`Contact` pair for the given branch and
   email (a second submission from the same email within the same branch
   reuses the same Customer/Contact rather than creating a duplicate);
2. creates a `Ticket` for that Contact via the existing
   `createTicketForContact` path (identical to how a portal customer's
   own ticket is created);
3. records the submitted message as an inbound `ChannelMessage` with
   `channelType: "WEB_FORM"` on that ticket — the first real `WEB_FORM`
   producer.

The created ticket is then visible to agents through every existing
mechanism unchanged (`GET /tickets`, ticket detail, `GET /tickets/:id/
messages`, real-time `ticket:{id}` relay) — no new agent-facing surface is
needed because none of it is channel-specific.

## Non-Goals

- **No frontend widget or page.** The architecture describes this as a
  public API endpoint an external site embeds its own form against, not a
  portal screen (`apps/portal`'s `PortalModule` doc explicitly scopes
  itself to "submit ticket, view/track own tickets... Knowledge Base
  browsing, CSAT" for its *authenticated* audience — an anonymous web-form
  submitter is a different audience entirely). Mirrors Stories 36/37's own
  precedent of a backend-only endpoint whose frontend consumer, if any,
  arrives in a later, separate story.
- **No public branch-picker/listing endpoint.** `IdentityService.
  listBranches` returns only the *caller's own* branch (there has never
  been a "list every branch" capability anywhere in this codebase, agent-
  facing or otherwise — confirmed by Recon). Inventing one is out of scope
  for this story; the caller supplies `branchId` directly (Design decision
  1), exactly like every embeddable per-branch contact form in practice
  already knows which branch's page it lives on.
- **No CAPTCHA or spam-scoring.** Rate limiting (`@Throttle`) is the only
  abuse mitigation this story adds, matching the architecture's own
  wording ("a public, **rate-limited** API endpoint") and
  `docs/architecture/05-auth-and-security.md`'s existing "NestJS Throttler
  protects auth, portal, and inbound webhook endpoints" policy, which this
  endpoint now also falls under.
- **No attachment support.** `AttachmentsModule`'s upload flow is
  authenticated end-to-end; wiring an anonymous upload path is a separate,
  larger concern this story does not take on.
- **No `EMAIL`/`WHATSAPP`/`SMS` producer.** Still blocked on an unresolved
  external-provider decision — unchanged, see this feature's
  `00-overview.md`.
- **No portal-account creation.** The `Contact` created here has no
  `passwordHash` (stays `null`, exactly like every agent-created Contact
  today) — Customer Portal access remains agent-granted only
  (`docs/architecture/05-auth-and-security.md`: "no self-registration"),
  unchanged by this story.

## Design decisions

1. **`branchId` is a required, client-supplied field, not resolved
   server-side.** There is no `TenantContext` on an anonymous request (no
   JWT at all — `TenantMiddleware` leaves `tenantClaims` unset, exactly
   like every other unauthenticated route) and no "list all branches"
   capability exists to build a picker against without expanding this
   story's scope (Non-Goals). The submitted `branchId` is validated to
   reference an existing, **active** `Branch` via one direct `prisma.
   branch.findFirst` lookup — this mirrors `TicketsService.
   requireDepartmentInScope`'s and `IdentityService.updateBranch`'s own
   existing precedent of a service reading another domain's `Branch`/
   `Department` row directly for a scope-existence check, not a new
   cross-module data-access pattern.

2. **Find-or-create is keyed on `(branchId, email)`, not email alone.**
   `Contact.email` is unique only per-`Customer` (the model's own doc
   comment), and `Customer` is branch-scoped — there is no global
   "customer by email" concept anywhere in this codebase. A new
   `CustomersService.findOrCreateContactForWebForm(branchId, { fullName,
   email, phone })` method:
   - looks up `prisma.contact.findFirst({ where: { email, customer: {
     branchId } } })` — the first `Contact` with this email under *any*
     `Customer` in this branch;
   - if found, reuses that `Contact`/`Customer` pair unchanged (a second
     web-form submission from the same person does not fragment their
     history across duplicate Customer records, the same real-world
     expectation `translateDuplicateEmail`'s own per-Customer uniqueness
     already protects against inside one Customer);
   - if not found, creates a brand-new `Customer` (`displayName:
     fullName`) and a `Contact` (`isPrimary: true`, matching
     `createContact`'s own default-`false`-unless-told-otherwise
     convention inverted here because this *is* the first, and so far
     only, contact for a brand-new Customer) under it, in one call —
     mirrors how a first-time inbound email or chat commonly creates a
     new CRM record in any real support system.
   - This method takes `branchId` as a parameter (no `TenantContext`
     dependency at all) — it does not replace or alter
     `CustomersService.createCustomer`/`createContact` (both still require
     `TenantContext`, unchanged, agent-only).

3. **Ticket creation reuses `TicketsService.createTicketForContact`
   unchanged.** No new ticket-creation code path — the found-or-created
   `contactId` is passed straight through, identical to how Story 53's
   portal flow and Story 85's escalation flow already call it. `category`
   is optional and passed through verbatim; `priority`/`departmentId`/
   `assignedToUserId` stay unset (agent-triage concerns a submitter
   doesn't set — mirrors `PortalCreateTicketDto`'s own documented
   narrowing).

4. **The submitted message is recorded via a new, narrow
   `TicketChannelService.recordWebFormMessage(ticketId, contactId, body)`
   method**, not a new `ChannelMessagesService` method (already generic
   over `ChannelType`) and not `TicketChannelService.createCustomerMessage`
   (hardcodes `"LIVE_CHAT"` and re-checks ticket ownership via
   `getTicketForCustomer` — redundant and wrong-channel here). Mirrors
   `recordAiChatTranscript`'s own documented precedent exactly: "No
   authorization check of its own — the caller just created `ticketId` for
   this exact `contactId` a moment ago."

5. **New orchestrator lives in `TicketsModule`, not `ChannelsModule`.**
   `ChannelsModule`'s own doc comment (Story 77) already states "ticket-
   scoped orchestration... lives in `TicketsModule`" — this story adds a
   second orchestrator there (`WebFormIntakeService`) alongside
   `TicketChannelService`, composing `CustomersService` (new import —
   `TicketsModule` now imports `CustomersModule`, alongside its existing
   `AiModule`/`ChannelsModule`/`QueuesModule` imports), `TicketsService`,
   and `TicketChannelService`. No import cycle: `CustomersModule` imports
   nothing from `TicketsModule`.

6. **Route: `POST /api/v1/channels/web-form`**, `@Public()`, with a
   route-specific `@Throttle({ default: { limit: 20, ttl: 60_000 } })` —
   tighter than the global default (`100`/`60_000`, `app.module.ts`),
   the first per-route override in the codebase, justified by this being
   the first fully anonymous, unauthenticated *write* endpoint (`/auth/
   login` is also `@Public()` but only reads/verifies credentials it
   already owns; a web form lets a stranger create data). The path is
   named for the domain it belongs to (`channels/web-form`), independent
   of which module file the controller physically lives in — the same way
   `PortalModule`'s controllers already live under `portal/*` routes while
   composing services from three other modules.

7. **Response shape: the full `TicketSummary`** (id, subject, category,
   priority, status, customerId, contactId, departmentId,
   assignedToUserId, timestamps) — identical to every other ticket-
   creation endpoint's response shape (`POST /tickets`, `POST /portal/
   tickets`), so a caller (the embedding site) can show/store the new
   ticket's id for a "we'll be in touch about ticket #..." confirmation.

## Context — Read These Files First

- `apps/api/src/modules/tickets/tickets.service.ts` — the "Story 53 —
  Customer Portal (customer-scoped, no `TenantContext`)" section,
  specifically `createTicketForContact`.
- `apps/api/src/modules/tickets/ticket-channel.service.ts` — the whole
  file, especially `recordAiChatTranscript`'s doc comment (the exact
  "no authorization of its own" precedent this story's new method
  mirrors) and `createCustomerMessage` (the pattern this story's new
  method deliberately does *not* reuse, and why).
  `apps/api/src/modules/channels/channel-messages.service.ts` —
  `createInboundFromContact`'s existing signature (already generic over
  `ChannelType`, no change needed).
- `apps/api/src/modules/customers/customers.service.ts` — `createCustomer`/
  `createContact`/`translateDuplicateEmail`, and the `Contact` Prisma model
  doc comment ("Email is unique per Customer, never globally").
- `apps/api/src/modules/tickets/tickets.module.ts` /
  `apps/api/src/modules/customers/customers.module.ts` — current
  imports/exports (`CustomersModule` exports `CustomersService` only,
  no controller-level dependency).
- `apps/api/src/common/auth/public.decorator.ts`,
  `apps/api/src/modules/identity/identity.controller.ts` (`login`'s
  `@Public()` usage) — the exact unauthenticated-route convention.
- `apps/api/src/common/audit/audit.interceptor.ts` — confirms a `@Public()`
  mutating POST is still audit-logged correctly with `actorId: null`
  (no change needed there).
- `apps/api/src/app.module.ts` — `ThrottlerModule.forRoot([{ ttl: 60_000,
  limit: 100 }])`, the default this story's route-level `@Throttle`
  overrides.
- `apps/api/prisma/schema.prisma` — `ChannelType` enum (`WEB_FORM` already
  present, no migration needed), `Contact`/`Customer`/`Ticket` models.

## Backend Tasks

1. **`apps/api/src/modules/customers/customers.service.ts`** — add:
   ```ts
   /** Story 87 — Web-form intake (no TenantContext; the caller has no
    * branch session at all). Finds an existing Contact with this email
    * under this branch (searched across every Customer in the branch,
    * since email is unique only per-Customer, never globally — see this
    * file's own Contact-model doc comment); creates a brand-new
    * Customer + Contact when none exists. */
   async findOrCreateContactForWebForm(
     branchId: string,
     input: { fullName: string; email: string; phone?: string },
   ): Promise<{ customerId: string; contactId: string }> {
     const branch = await this.prisma.branch.findFirst({
       where: { id: branchId, isActive: true },
     });
     if (!branch) {
       throw new NotFoundException("Branch not found");
     }

     const existing = await this.prisma.contact.findFirst({
       where: { email: input.email, customer: { branchId } },
     });
     if (existing) {
       return { customerId: existing.customerId, contactId: existing.id };
     }

     const customer = await this.prisma.customer.create({
       data: { branchId, displayName: input.fullName },
     });
     const contact = await this.prisma.contact.create({
       data: {
         customerId: customer.id,
         fullName: input.fullName,
         email: input.email,
         phone: input.phone ?? null,
         isPrimary: true,
       },
     });
     return { customerId: customer.id, contactId: contact.id };
   }
   ```

2. **`apps/api/src/modules/tickets/ticket-channel.service.ts`** — add:
   ```ts
   /** Story 87 — the public Web-Form intake orchestrator's final step:
    * records the submitted message on the ticket just created for this
    * contact. No authorization check of its own — mirrors
    * `recordAiChatTranscript`'s identical "caller already owns this
    * brand-new ticket/contact pairing" precedent (Story 85). */
   async recordWebFormMessage(ticketId: string, contactId: string, body: string): Promise<void> {
     await this.channelMessagesService.createInboundFromContact(
       ticketId,
       "WEB_FORM",
       contactId,
       body,
     );
   }
   ```

3. **New `apps/api/src/modules/tickets/dto/submit-web-form-ticket.dto.ts`**:
   `branchId` (`@IsUUID()`), `fullName` (`@IsString() @MinLength(1)
   @MaxLength(200)`), `email` (`@IsEmail()`), `phone` (optional
   `@IsString() @MaxLength(50)`), `subject` (`@IsString() @MinLength(1)
   @MaxLength(200)`), `category` (optional `@IsString()`), `message`
   (`@IsString() @MinLength(1) @MaxLength(5000)`).

4. **New `apps/api/src/modules/tickets/web-form-intake.service.ts`**:
   ```ts
   @Injectable()
   export class WebFormIntakeService {
     constructor(
       private readonly customersService: CustomersService,
       private readonly ticketsService: TicketsService,
       private readonly ticketChannelService: TicketChannelService,
     ) {}

     async submit(dto: SubmitWebFormTicketDto): Promise<TicketSummary> {
       const { contactId } = await this.customersService.findOrCreateContactForWebForm(
         dto.branchId,
         { fullName: dto.fullName, email: dto.email, phone: dto.phone },
       );
       const ticket = await this.ticketsService.createTicketForContact(contactId, {
         subject: dto.subject,
         category: dto.category,
       });
       await this.ticketChannelService.recordWebFormMessage(ticket.id, contactId, dto.message);
       return ticket;
     }
   }
   ```

5. **New `apps/api/src/modules/tickets/web-form-intake.controller.ts`**:
   ```ts
   @ApiTags("channels")
   @Controller("channels/web-form")
   export class WebFormIntakeController {
     constructor(private readonly webFormIntakeService: WebFormIntakeService) {}

     @Public()
     @Throttle({ default: { limit: 20, ttl: 60_000 } })
     @Post()
     submit(@Body() dto: SubmitWebFormTicketDto): Promise<TicketSummary> {
       return this.webFormIntakeService.submit(dto);
     }
   }
   ```

6. **`apps/api/src/modules/tickets/tickets.module.ts`** — import
   `CustomersModule`; register `WebFormIntakeController` in `controllers`
   and `WebFormIntakeService` in `providers`; update the module doc
   comment with a short Story 87 note mirroring the existing Story 73/76/77
   notes' style.

## Edge Cases & Failure Modes

- **Unknown/inactive `branchId`**: `NotFoundException` (404) — mirrors
  every other "scope reference doesn't resolve" case in this codebase
  (`TicketsService.createTicket`'s own customer/department/user checks).
- **Same email, same branch, second submission**: reuses the existing
  Customer/Contact — a *new* `Ticket` is still created each time (a repeat
  visitor filing a second, different request is not the same request;
  ticket de-duplication is out of scope).
- **Same email, different branch**: creates a *separate* Customer/Contact
  in the other branch — branches are the isolation boundary
  (`docs/architecture/04-data-and-multitenancy.md`), unchanged by this
  story.
- **Malformed email / missing required field**: `400` from the global
  `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`),
  identical to every other DTO in the codebase.
- **More than 5 submissions from the same IP within 60 seconds**: `429`
  from `ThrottlerGuard`, using this route's own tighter limit.
- **A field the DTO doesn't declare (e.g. `customerId`, `priority`,
  `assignedToUserId`)**: rejected by `forbidNonWhitelisted`, exactly like
  `PortalCreateTicketDto` already rejects out-of-scope fields for a
  portal-authenticated submitter — an anonymous submitter can set even
  less.

## Test Plan

1. **`apps/api/src/modules/customers/customers.service.spec.ts`** — new
   `findOrCreateContactForWebForm` describe block: creates a new Customer
   + Contact when none exists (`isPrimary: true`, `displayName ===
   fullName`); reuses the existing Contact/Customer for a repeat email in
   the same branch; creates a *separate* Customer for the same email in a
   *different* branch (mocked); throws `NotFoundException` for an unknown
   branch id; throws `NotFoundException` for an inactive branch.
2. **`apps/api/src/modules/tickets/ticket-channel.service.spec.ts`** — new
   test for `recordWebFormMessage`: calls
   `channelMessagesService.createInboundFromContact` with
   `channelType: "WEB_FORM"` and the given `ticketId`/`contactId`/`body`,
   performs no ticket lookup of its own (unlike `createCustomerMessage`).
3. **New `apps/api/src/modules/tickets/web-form-intake.service.spec.ts`**
   — mocks `CustomersService`/`TicketsService`/`TicketChannelService`;
   asserts the three calls happen in order with the right arguments and
   the method resolves with the created `TicketSummary`.
4. **New `apps/api/test/channels-web-form.e2e-spec.ts`** — bootstraps the
   real `AppModule` (mirrors `portal-tickets.e2e-spec.ts`'s exact
   `beforeAll` shape), logs in as the seed admin only to read the seeded
   branch id via `GET /api/v1/identity/branches`:
   - rejects a request missing required fields (400), no auth header
     needed;
   - rejects an unknown `branchId` (404);
   - creates a ticket + a `WEB_FORM` `ChannelMessage` for a brand-new
     email — response is a full `TicketSummary` with `status: "OPEN"`;
     the message is then visible to an agent via
     `GET /api/v1/tickets/:id/messages` with
     `channelType: "WEB_FORM"`, `direction: "INBOUND"`,
     `senderContactId` set, `senderUserId: null`;
   - a second submission with the same email creates a *second* Ticket
     but reuses the same `contactId` (visible via
     `GET /api/v1/customers/:customerId/contacts` as agent, or by
     comparing the two tickets' `contactId` fields directly);
   - enforces its own tighter rate limit: fires more requests than the
     configured limit within the window and asserts at least one `429`
     among the responses (placed last in the file, after every other test
     that calls this route, using a limit comfortably above the total
     number of prior successful/attempted calls so earlier tests are
     unaffected).

## Migration / Rollback

- **No Prisma schema change** — `ChannelType.WEB_FORM` already exists
  (Story 77's migration). Nothing to migrate.
- **Rollback**: revert `tickets.module.ts`'s new import/providers/
  controllers, delete the three new files, revert
  `ticket-channel.service.ts`'s new method and
  `customers.service.ts`'s new method. Fully additive — no existing
  route, method, or event is modified, so a partial rollback is harmless
  (an unregistered controller simply serves no route).

## Verification Steps

1. `pnpm --filter @crm/api typecheck && pnpm --filter @crm/api lint`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or, if the sandbox's
   `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` gate blocks
   `test:e2e:prepare`'s `migrate reset --force`: `pnpm prisma:seed` from
   `apps/api`, then `npx vitest run test/channels-web-form.e2e-spec.ts
   --no-file-parallelism` to verify this story's own e2e coverage in
   isolation, per `CLAUDE.md` §5's documented fallback).
4. `pnpm typecheck && pnpm lint && pnpm build`
5. `git status --short`

## Done Criteria

- [ ] `POST /api/v1/channels/web-form` exists, is `@Public()`, and is
      throttled tighter than the global default.
- [ ] A submission finds-or-creates a Customer/Contact by `(branchId,
      email)`, creates a `Ticket` via the existing customer-scoped path,
      and records the message as an inbound `WEB_FORM` `ChannelMessage`.
- [ ] The created ticket and message are visible to agents through every
      existing endpoint unchanged (no new agent-facing surface added).
- [ ] Unknown/inactive `branchId` → 404; validation failures → 400; rate
      limit exceeded → 429.
- [ ] Every item in `## Test Plan` is added and passing.
- [ ] Every command in `## Verification Steps` passes (or is substituted
      per its own documented fallback).
- [ ] Every pre-existing test suite remains green, unweakened.
