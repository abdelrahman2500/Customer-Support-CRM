# Story 91 — Communication/Channels: Quick Replies

## Prerequisites

- `customer-portal-live-chat` Story 77/78 —
  `apps/api/src/modules/channels/channels.module.ts`/`channel-messages.service.ts`
  (`ChannelsModule`, currently exports only `ChannelMessagesService` and has
  no controller of its own), `apps/web/src/components/tickets/ticket-chat-card.tsx`
  (`TicketChatCard`/`ChatComposer` — the exact ticket-detail chat composer
  this story's picker attaches to).
- `sla-automation-rules` Story 57 —
  `apps/api/src/modules/sla-policies/{automation-rules.service,automation-rules.controller}.ts`,
  `apps/web/src/components/automation-rules/automation-rules-view.tsx`,
  `apps/web/src/lib/automation-rules-api.ts`,
  `apps/web/src/hooks/use-automation-rules.ts` — the exact "branch-admin
  resource, arbitrary list (not a fixed enumeration), `isActive` toggle"
  CRUD shape this story's backend and admin UI mirror.
- `notification-templates` Story 61 —
  `apps/api/src/modules/notifications/notification-templates.service.ts` —
  the exact "branch-admin resource, no cross-entity validation" service
  shape (unlike `AutomationRulesService`, which validates
  `actionAssignToUserId`/`actionSetDepartmentId` against the branch) this
  story's simpler service mirrors.

All are complete and already merged to `main`.

## Story Goal

Close `docs/architecture/03-domain-boundaries.md`'s Communication/Channels
row's last remaining, non-provider-blocked named noun: **quick replies**
(canned agent responses). A branch admin/agent with permission manages a
list of reusable response templates (title + body); any agent with read
access can insert one into the existing ticket chat composer
(`TicketChatCard`'s `ChatComposer`, Story 78) while replying to a ticket,
instead of retyping common answers.

## Non-Goals

- **No "channel configuration" or "threads" work.** Both remain
  speculative — no per-branch channel enable/disable requirement is
  disclosed anywhere, and every live channel today (`LIVE_CHAT`/`AI_CHAT`/
  `WEB_FORM`) is ticket-scoped with `Ticket` itself already serving as the
  thread; a dedicated `Thread` model would anticipate the still-blocked
  `EMAIL`/`WHATSAPP`/`SMS` channels. See this feature's `00-overview.md`
  for the full reasoning.
- **No variable interpolation / merge fields** (e.g. `{{customerName}}`).
  A quick reply's `body` is inserted into the composer verbatim, exactly
  like `NotificationTemplate`'s own `template` string is rendered without
  interpolation beyond what `notification-template-render.ts` already does
  for a *different*, unrelated purpose (event notifications, not agent
  replies). Out of scope — the simplest version of this feature ships
  first, matching this codebase's own consistent "smallest surface first"
  precedent (`AutomationRule`, `NotificationTemplate`).
- **No department-level scoping.** Branch-scoped only, mirroring
  `NotificationTemplate`/`AutomationRule` exactly — no story has disclosed
  a need for department-specific canned responses.
- **No hard delete.** `isActive` soft-toggle only, mirroring
  `AutomationRule`'s exact "no resource in this codebase is ever hard-
  deleted via the API" convention (confirmed by Recon: no `@Delete` route
  exists anywhere in `apps/api/src/modules`).
- **No portal-side / customer-facing quick replies.** Agent-only, matching
  the domain's own "agent tooling" framing — a customer never composes a
  reply *to* an agent through a canned-response picker.
- **No Customer Portal changes at all.** `apps/portal` is untouched.
- **No AI-suggested quick replies / no relation to `TicketAiService.
  suggestReply`.** That is a per-ticket, AI-generated one-off suggestion
  (Story 74); this is a reusable, admin-authored, branch-wide library.
  Unrelated features that happen to both produce text for the same
  composer.

## Design decisions

1. **New `QuickReply` Prisma model in the `channels` schema**, owned by
   `ChannelsModule` — this is the domain-boundaries table's literal "quick
   replies" cell. Branch-scoped, no department scoping, no unique
   constraint on `title` (mirrors `AutomationRule.name`'s exact shape —
   `@@index([branchId])` only, no `@@unique`):
   ```prisma
   model QuickReply {
     id        String   @id @default(uuid())
     branchId  String   @map("branch_id")
     branch    Branch   @relation(fields: [branchId], references: [id])
     title     String
     body      String
     isActive  Boolean  @default(true) @map("is_active")
     createdAt DateTime @default(now()) @map("created_at")
     updatedAt DateTime @updatedAt @map("updated_at")

     @@index([branchId])
     @@map("quick_replies")
     @@schema("channels")
   }
   ```
   `Branch` gains the back-relation `quickReplies QuickReply[]` — the same
   kind of same-schema-domain-owned back-relation `Branch.automationRules`/
   `Branch.notificationTemplates` already carry.

2. **New `QuickRepliesService`/`QuickRepliesController`, added directly to
   the existing `ChannelsModule`** (its first controller — until now the
   module exported only `ChannelMessagesService` for `TicketsModule` to
   consume). `TenantContext` is provided here the same way every other
   feature module provides it (`SlaPoliciesModule`/`NotificationsModule`'s
   own doc-comment precedent). `QuickRepliesService` mirrors
   `NotificationTemplatesService`'s shape exactly (branch-scoped CRUD, no
   cross-entity validation) rather than `AutomationRulesService`'s (which
   validates `actionAssignToUserId`/`actionSetDepartmentId` against the
   branch) — a quick reply has no foreign-key fields to validate. Not
   exported — no other module needs it (mirrors `NotificationTemplatesService`'s
   own "not exported" precedent exactly).

3. **Three new permissions**: `quick-reply:create`, `quick-reply:read`,
   `quick-reply:update` — appended to `apps/api/prisma/seed.ts`'s
   `PERMISSION_CATALOG` (auto-granted to `SuperAdmin`, which grants the
   full catalog; `Agent` stays at its existing empty baseline, unchanged —
   mirrors every other resource's exact seeding precedent. A real
   deployment grants `quick-reply:read` to its Agent role via the existing
   Role/Permission admin UI, Story 46, the same way it would grant
   `ticket:read`/`notification:read` today).

4. **Route: `/quick-replies`** — `POST` (`quick-reply:create`), `GET`
   (`quick-reply:read`), `PATCH /:id` (`quick-reply:update`). No `GET /:id`
   — mirrors `NotificationTemplatesController`'s exact 3-route shape (not
   `AutomationRulesController`'s 4-route shape, which needs `GET /:id` for
   the ticket-detail action picker it doesn't have); this story's own admin
   view is a single-page list (Design decision 5), so per-row data already
   comes from the list query — no dedicated single-item fetch is ever
   needed.

5. **New agent-workspace admin page, `/quick-replies`**, mirroring
   `AutomationRulesView`'s exact "table + inline add-form below it, no
   separate route" single-page shape (arbitrary list, not
   `NotificationTemplatesView`'s fixed-3-row shape) — a quick reply is an
   open-ended list, exactly like automation rules. Appended to
   `WorkspaceNav`'s `NAV_ITEMS` as the new last entry, same append
   convention every prior addition used.

6. **`ChatComposer` (`apps/web/src/components/tickets/ticket-chat-card.tsx`)
   gains a quick-reply `Select`** above the existing textarea, populated
   from `useQuickRepliesQuery()` filtered to `isActive` rows only (mirrors
   `BranchNotifications`/`PortalNotifications`'s own "while loading/erroring,
   never break the primary flow" resilience rule — a loading/failed
   quick-replies fetch simply hides the picker; the composer itself is
   never blocked by it). Selecting one inserts the reply's `body` into the
   draft: replaces it if empty, else appends with a blank-line separator —
   never silently discards what the agent already typed. The select value
   resets to its placeholder immediately after insertion so the same reply
   can be inserted again.

7. **New, dedicated frontend files** (`quick-replies-api.ts`,
   `use-quick-replies.ts`, `quick-replies-view.tsx`), mirroring
   `automation-rules-api.ts`/`use-automation-rules.ts`/
   `automation-rules-view.tsx`'s exact "distinct domain, own file" split —
   not folded into `ticket-messages-api.ts` (a quick reply is not a
   `ChannelMessage`) and not into `notification-templates-api.ts` (an
   unrelated domain that happens to share the "branch-admin template CRUD"
   shape).

## Context — Read These Files First

1. `apps/api/src/modules/channels/{channels.module,channel-messages.service}.ts`
   — the module this story's new controller/service are added to.
2. `apps/api/src/modules/sla-policies/{automation-rules.service,automation-rules.controller,automation-rules.service.spec}.ts`
   and `apps/api/src/modules/notifications/notification-templates.service.ts`
   — the two CRUD shapes this story's backend blends (Notification
   Templates' simplicity + Automation Rules' arbitrary-list/`isActive`
   convention).
3. `apps/api/prisma/schema.prisma` — `AutomationRule`/`NotificationTemplate`
   models (the shape `QuickReply` mirrors), `Branch`'s existing back-relation
   list.
4. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG`/`ROLE_GRANTS`.
5. `apps/web/src/components/tickets/ticket-chat-card.tsx` (whole file,
   especially `ChatComposer`) and its `ticket-chat-card.spec.tsx` — the
   exact mount point and existing mock conventions this story extends.
6. `apps/web/src/components/automation-rules/automation-rules-view.tsx` +
   `apps/web/src/lib/automation-rules-api.ts` +
   `apps/web/src/hooks/use-automation-rules.ts` — the three-file split and
   table/row/add-form shape this story's admin UI mirrors.
7. `apps/web/src/components/workspace/workspace-nav.tsx` — the nav list
   this story appends to.
8. `apps/web/messages/{en,ar}.json` — `automationRules`/`tickets.detail.chat*`
   sections (exact tone/shape to mirror), `workspace.nav`.
9. `apps/api/test/automation-rules.e2e-spec.ts` — the e2e shape (auth/403/
   CRUD) this story's own e2e spec mirrors, minus the ticket-matching
   tests (no reactive behavior here).

## Backend Tasks

1. **`apps/api/prisma/schema.prisma`** — add the `QuickReply` model (Design
   decision 1) and `Branch.quickReplies QuickReply[]`.
2. **Migration** — generated via `prisma migrate dev`.
3. **`apps/api/prisma/seed.ts`** — append `"quick-reply:create"`,
   `"quick-reply:read"`, `"quick-reply:update"` to `PERMISSION_CATALOG`.
4. **New `apps/api/src/modules/channels/dto/create-quick-reply.dto.ts`** —
   `title` (`@IsString() @MinLength(1) @MaxLength(200)`), `body`
   (`@IsString() @MinLength(1) @MaxLength(2000)`).
5. **New `apps/api/src/modules/channels/dto/update-quick-reply.dto.ts`** —
   `title?`/`body?` (same validators, optional), `isActive?`
   (`@IsBoolean()`, optional).
6. **New `apps/api/src/modules/channels/quick-replies.service.ts`**:
   ```ts
   export interface QuickReplySummary {
     id: string;
     title: string;
     body: string;
     isActive: boolean;
   }

   @Injectable()
   export class QuickRepliesService {
     constructor(
       private readonly prisma: PrismaService,
       private readonly tenantContext: TenantContext,
     ) {}

     async createQuickReply(dto: CreateQuickReplyDto): Promise<QuickReplySummary> {
       const { branchId } = this.tenantContext.requireBranchScope();
       const quickReply = await this.prisma.quickReply.create({
         data: { branchId, title: dto.title, body: dto.body },
       });
       return toSummary(quickReply);
     }

     async listQuickReplies(): Promise<QuickReplySummary[]> {
       const { branchId } = this.tenantContext.requireBranchScope();
       const quickReplies = await this.prisma.quickReply.findMany({
         where: { branchId },
         orderBy: { createdAt: "asc" },
       });
       return quickReplies.map(toSummary);
     }

     async updateQuickReply(id: string, dto: UpdateQuickReplyDto): Promise<{ id: string }> {
       const { branchId } = this.tenantContext.requireBranchScope();
       const existing = await this.prisma.quickReply.findFirst({ where: { id, branchId } });
       if (!existing) {
         throw new NotFoundException("Quick reply not found");
       }
       await this.prisma.quickReply.update({
         where: { id },
         data: {
           ...(dto.title !== undefined ? { title: dto.title } : {}),
           ...(dto.body !== undefined ? { body: dto.body } : {}),
           ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
         },
       });
       return { id };
     }
   }
   ```
7. **New `apps/api/src/modules/channels/quick-replies.controller.ts`**:
   `@Controller("quick-replies")`, `@Post()` → `quick-reply:create`,
   `@Get()` → `quick-reply:read`, `@Patch(":id")` → `quick-reply:update`.
8. **`apps/api/src/modules/channels/channels.module.ts`** — add
   `QuickRepliesController` to `controllers`, `QuickRepliesService` +
   `TenantContext` to `providers`; update the module doc comment with a
   Story 91 note (mirrors the file's existing Story 77/Story 85 notes'
   style — "first controller this module has ever had").

## Frontend Tasks

9. **New `apps/web/src/lib/quick-replies-api.ts`** — `QuickReplySummary`,
   `CreateQuickReplyInput`, `UpdateQuickReplyInput` types +
   `listQuickReplies`/`createQuickReply`/`updateQuickReply`, mirroring
   `automation-rules-api.ts`'s exact shape.
10. **New `apps/web/src/hooks/use-quick-replies.ts`** —
    `useQuickRepliesQuery`, `useCreateQuickReplyMutation`,
    `useUpdateQuickReplyMutation`, mirroring `use-automation-rules.ts`.
11. **New `apps/web/src/components/quick-replies/quick-replies-view.tsx`**
    — table (title, body preview, status) + row-level activate/deactivate
    button + inline "New quick reply" form (title, body), mirroring
    `AutomationRulesView`'s exact loading/error/empty/populated states and
    `AutomationRuleRow`/`AddAutomationRuleForm` shape (two fields instead
    of five).
12. **New `apps/web/src/app/[locale]/(agent)/quick-replies/page.tsx`** —
    renders `QuickRepliesView`, mirroring every other admin page's
    one-line shape.
13. **`apps/web/src/components/workspace/workspace-nav.tsx`** — append
    `{ href: "quick-replies", labelKey: "nav.quickReplies" }` to
    `NAV_ITEMS`; extend the file's own Story-history doc comment.
14. **`apps/web/src/components/tickets/ticket-chat-card.tsx`** —
    `ChatComposer` gains the quick-reply `Select` (Design decision 6),
    reading `useQuickRepliesQuery()`.
15. **i18n** — `apps/web/messages/{en,ar}.json`:
    - New `quickReplies` namespace (title, error, retry, empty, columns
      title/body/status, active/inactive, activate/deactivate,
      actionForbidden/actionFailed, createHeading, titleLabel, bodyLabel,
      createSubmit/createSubmitting/createFailed), mirroring
      `automationRules`'s exact key set minus the fields this resource
      doesn't have.
    - `workspace.nav.quickReplies`.
    - `tickets.detail.quickReplyPlaceholder` (the `Select`'s placeholder
      text, e.g. "Insert a quick reply...").

## Edge Cases & Failure Modes

- **Unauthenticated request**: `401`, identical to every other protected
  route.
- **Agent-role user lacking `quick-reply:*`**: `403` — `GET`/`POST` both
  rejected, mirrors `automation-rules.e2e-spec.ts`'s own test shape.
- **Unknown/other-branch id on `PATCH`**: `404` (`NotFoundException`,
  branch-scoped lookup masks cross-branch existence, identical to every
  other resource's `findXInScope` convention).
- **Malformed `title`/`body` (empty or over length)**: `400` from the
  global `ValidationPipe`.
- **Quick-replies fetch fails/loading in `ChatComposer`**: the picker is
  simply omitted (or shown disabled) — the composer's core send/receive
  flow is never affected. No test may assert the composer breaks when this
  query errors.
- **Selecting a quick reply while the draft already has unsaved text**:
  appended with a blank-line separator, never overwrites/discards existing
  text.

## Test Plan

**Backend unit** (new `apps/api/src/modules/channels/quick-replies.service.spec.ts`,
mirrors `automation-rules.service.spec.ts`'s exact mock-Prisma/mock-
TenantContext shape, without the cross-entity-validation describe blocks
that don't apply here):
- `createQuickReply` — assigns `branchId` from `TenantContext`, not the
  DTO; persists `title`/`body`.
- `listQuickReplies` — scopes the query by branch, ordered `createdAt`
  asc.
- `updateQuickReply` — throws `NotFoundException` for an id in a different
  branch or unknown; updates only the provided fields (`title` alone,
  `isActive` alone, both together).

**Backend e2e** (new `apps/api/test/quick-replies.e2e-spec.ts`, mirrors
`automation-rules.e2e-spec.ts`'s exact bootstrap/login shape):
- rejects an unauthenticated request (401) on `GET`;
- rejects an Agent-role user lacking `quick-reply:*` (403) on `GET` and
  `POST`;
- creates, lists, and updates (title/body edit, then `isActive: false`)
  a quick reply as the seed admin (who holds every permission);
- returns 404 updating an unknown id.

**Frontend component**:
- `quick-replies-view.spec.tsx` (new) — loading/error/empty/populated
  states; create-form submit; row activate/deactivate toggle; mirrors
  `automation-rules-view.spec.tsx`'s test shape.
- `ticket-chat-card.spec.tsx` (extended) — new `useQuickRepliesQuery` mock
  added alongside the file's existing hook mocks; a test asserting
  selecting a quick reply inserts its body into the (empty) textarea, and
  a second test asserting it *appends* (with a separator) to non-empty
  existing text rather than replacing it.

## Migration / Rollback

- **One migration**: new `quick_replies` table, `channels` schema. No
  existing table altered.
- **Rollback**: revert `channels.module.ts`'s new controller/provider
  registrations, delete the new backend/frontend files, revert
  `ticket-chat-card.tsx`'s `ChatComposer` addition, `workspace-nav.tsx`'s
  new nav entry, and `seed.ts`'s three new permission keys. Fully
  additive — no existing route, method, model, or event is modified.

## Verification Steps

1. `pnpm --filter @crm/api typecheck && pnpm --filter @crm/api lint`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or, if the sandbox's
   `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` gate blocks
   `test:e2e:prepare`'s `migrate reset --force`: `pnpm prisma:seed` from
   `apps/api`, then `npx vitest run test/quick-replies.e2e-spec.ts
   --no-file-parallelism` to verify this story's own e2e coverage in
   isolation, per `CLAUDE.md` §5's documented fallback). This story adds
   no new listener on any shared domain event, so the full non-isolated
   e2e sweep CLAUDE.md's task description calls for as an extra caution
   for event-bus changes is not required by this story's own risk profile,
   but is still run once as a general regression check per §5's own
   baseline instruction.
4. `pnpm --filter @crm/web test`
5. `pnpm typecheck && pnpm lint && pnpm build`
6. `git status --short`

## Done Criteria

- [ ] `QuickReply` model exists (`channels` schema), migration applied;
      `Branch` gains the `quickReplies` back-relation.
- [ ] `quick-reply:create`/`quick-reply:read`/`quick-reply:update`
      permissions exist in the seeded catalog.
- [ ] `POST`/`GET`/`PATCH /:id /quick-replies` exist, branch-scoped,
      permission-gated, 404-masking cross-branch access.
- [ ] New `/quick-replies` agent-workspace page lists, creates, and
      toggles quick replies; appended to `WorkspaceNav`.
- [ ] `ChatComposer` offers a quick-reply picker that inserts (never
      discards existing text) into the message draft.
- [ ] Both locales translated for every new string.
- [ ] Every item in `## Test Plan` is added and passing.
- [ ] Every command in `## Verification Steps` passes (or is substituted
      per its own documented fallback).
- [ ] Every pre-existing test suite remains green, unweakened.
