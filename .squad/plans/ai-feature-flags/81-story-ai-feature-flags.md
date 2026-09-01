# Story 81 — AI Feature Flags per Branch

## Prerequisites

- Story 72 (`ai-services-foundation`): `AiFeature` enum, `AiPromptLog`,
  and — critically — the `DISABLED` outcome's own documented meaning
  ("no `ANTHROPIC_API_KEY` configured... never conflated with `ERROR`").
  This story reuses that exact outcome for a second, distinct cause (an
  admin explicitly turning a feature off), deliberately keeping both
  causes indistinguishable to a caller — see "Design decision" below.
- Story 62 (`admin-branch-branding`): the one-row-per-branch,
  absence-means-default, upsert-on-`PATCH` shape this story's own
  `AiSettings` model/service/controller mirror exactly.
- Stories 73–75 (ticket-scoped summarize/suggest-reply/categorize),
  Story 80 (`ai-portal-chatbot`): the three real call sites
  (`TicketAiService.submit`, `AiChatService.sendMessage`) this story
  gates.

All prerequisites are complete. The AI vendor is already decided
(Anthropic Claude behind `AiProvider`) — this story touches no
provider-selection code, only an internal branch-scoped on/off check
consulted before an `ai-processing` job is ever enqueued.

---

## Story Goal

Every AI ticket-assist/chat feature shipped so far (Stories 73–75, 80) is
either always-on or always-off (environment-driven, via
`ANTHROPIC_API_KEY`) — there is no way for a branch admin to disable one
feature (e.g. the chatbot) while keeping others on, or to turn AI off for
one branch without redeploying. `docs/architecture/07-sla-automation-and-
ai.md` line 17 states plainly: *"Features are flaggable per branch."*
This story delivers that:

1. A new, branch-scoped `AiSettings` row (`ai` schema) with one boolean
   per feature (`summarizeEnabled`, `suggestReplyEnabled`,
   `categorizeEnabled`, `chatEnabled`), defaulting to enabled.
2. `GET`/`PATCH /ai/settings` (branch-scoped, new `ai:read`/`ai:update`
   permissions), mirroring `BrandingController`'s exact shape.
3. `TicketAiService.submit` and `AiChatService.sendMessage` consult the
   flag for their own feature *before* creating a pending log/enqueueing
   — when disabled, they instead create the `AiPromptLog` row already
   resolved to `DISABLED` (no worker involvement at all) and return
   immediately.
4. A new admin settings page in `apps/web`, mirroring `BrandingView`.

**Not in scope:** per-feature flags surfaced anywhere in `apps/portal`
(the portal chat widget already renders `DISABLED` correctly via Story
80's own polling — no new portal UI is needed to *observe* the flag, only
the admin UI to *set* it), any change to `AnthropicAiProvider`/
`NullAiProvider`/`packages/ai`/provider selection, rate limiting/quota
(a numeric cap, not a boolean), and any retroactive effect on already
in-flight `PENDING` operations (a flag flipped mid-flight never cancels a
job already enqueued — the next *new* operation is the first one affected).

---

## Design decision — reuse `DISABLED`, not a new outcome

`AiOutcome.DISABLED`'s own doc comment (`schema.prisma`) already commits
to one specific meaning: *"no `ANTHROPIC_API_KEY` configured."* This
story reuses it for a second cause (a branch admin explicitly disabling
the feature) rather than inventing e.g. `AiOutcome.OFF`, because:

- The frontend contract is already exactly right: `TicketAiCard`/
  `ChatWidget` already render `DISABLED` as *"AI isn't available"* —
  precisely the correct, generic message for either cause. A caller
  never needs to distinguish "no API key" from "admin turned it off";
  both mean the same actionable thing ("AI can't help with this right
  now").
- Adding a fifth `AiOutcome` value would require every existing
  outcome-switch in `apps/web`/`apps/portal` (already covering exactly
  four cases: `PENDING`/`SUCCESS`/`ERROR`/`DISABLED`) to add a matching
  branch for zero behavioral difference — pure churn.
- `model: "disabled"` (the literal string `NullAiProvider` already
  writes for the API-key-absent case) is reused for the branch-disabled
  case too, for the same reason: a caller inspecting the raw log row
  sees a single, already-understood signal for "AI is off here," not two
  different literal strings meaning the same thing.

The only loss is that an operator cannot tell from the `AiPromptLog` row
alone *why* a given `DISABLED` row happened (missing key vs. admin
toggle) — an acceptable trade-off, since `AiSettings`'s own current state
already answers that question directly and immediately for whichever
branch is in question.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `BrandingConfig` (lines ~217–229,
   the exact model shape to mirror) and `AiPromptLog`/`AiFeature`/
   `AiOutcome` (~853–930).
2. `apps/api/src/modules/admin/branding.controller.ts`,
   `branding.service.ts`, `dto/update-branding.dto.ts`,
   `branding.service.spec.ts` — the complete pattern this story's
   `AiSettingsController`/`AiSettingsService`/`UpdateAiSettingsDto` mirror
   line-for-line (absence-means-default `GET`, upsert `PATCH`).
3. `apps/api/src/modules/ai/ai-gateway.service.ts` (whole file) —
   `createPendingLog`'s exact shape is what the new `createDisabledLog`
   mirrors (same parameters, `outcome: "DISABLED"`/`model: "disabled"`
   instead).
4. `apps/api/src/modules/ai/ai.module.ts` — `AiSettingsService`/
   `AiSettingsController`/`TenantContext` are added here (mirrors how
   `AdminModule` provides `TenantContext` for `BrandingService`); no
   change needed to `TicketsModule`/`PortalModule`, which already import
   `AiModule`.
5. `apps/api/src/modules/tickets/ticket-ai.service.ts` — `submit()`
   (the method gaining the flag check) and its constructor (gaining
   `AiSettingsService`).
6. `apps/api/src/modules/ai/ai-chat.service.ts` — `sendMessage()` (same
   change) and its constructor.
7. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG` (new `ai:read`/
   `ai:update` keys, granted to `SuperAdmin` automatically via
   `ROLE_GRANTS.SuperAdmin: PERMISSION_CATALOG`).
8. `apps/web/src/components/admin/branding-view.tsx`,
   `apps/web/src/hooks/use-branding.ts`,
   `apps/web/src/lib/branding-api.ts`,
   `apps/web/src/app/[locale]/(agent)/branding/page.tsx`,
   `apps/web/src/components/workspace/workspace-nav.tsx` — the exact
   frontend shape (page/hook/API-client/nav-entry) this story's own
   `ai-settings-view.tsx`/`use-ai-settings.ts`/`ai-settings-api.ts`/
   `(agent)/ai-settings/page.tsx` mirror.
9. `apps/web/src/components/tickets/ticket-ai-card.tsx` and
   `apps/portal/src/components/chat/chat-widget.tsx` — confirms both
   already render `DISABLED` distinctly; neither needs any change.

---

## Backend Tasks

### 1 — Schema: `AiSettings`

**File: `apps/api/prisma/schema.prisma`** — new model, in the `ai`
schema alongside `AiPromptLog`/`ChatSession`:

```prisma
/// Story 81 — one row per branch, mirrors `BrandingConfig`'s exact
/// shape/conventions. Absence of a row means every feature is enabled
/// (the pre-Story-81 behavior, unchanged) — see AiSettingsService's own
/// DEFAULT_AI_SETTINGS.
model AiSettings {
  id                  String   @id @default(uuid())
  branchId            String   @unique @map("branch_id")
  branch              Branch   @relation(fields: [branchId], references: [id])
  summarizeEnabled    Boolean  @default(true) @map("summarize_enabled")
  suggestReplyEnabled Boolean  @default(true) @map("suggest_reply_enabled")
  categorizeEnabled   Boolean  @default(true) @map("categorize_enabled")
  chatEnabled         Boolean  @default(true) @map("chat_enabled")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  @@map("ai_settings")
  @@schema("ai")
}
```

Add `Branch.aiSettings AiSettings?` back-relation (next to
`aiPromptLogs`/`chatSessions`).

Generate the migration from `apps/api`:
`pnpm prisma migrate dev --name add_ai_settings`.

### 2 — `AiGatewayService.createDisabledLog`

**File: `apps/api/src/modules/ai/ai-gateway.service.ts`** — a new method,
same parameter shape as `createPendingLog` (including the mutually
exclusive `ticketId`/`chatSessionId` pair from Story 80), writing the row
already resolved:

```ts
async createDisabledLog(
  feature: AiFeature,
  branchId: string,
  ticketId: string | null,
  chatSessionId: string | null,
  promptRefValue: string,
): Promise<{ id: string }> {
  const log = await this.prisma.aiPromptLog.create({
    data: {
      branchId,
      ticketId,
      chatSessionId,
      feature,
      model: "disabled",
      promptRef: promptRefValue,
      inputTokens: null,
      outputTokens: null,
      latencyMs: null,
      outcome: "DISABLED",
      outputText: null,
      errorMessage: null,
    },
  });
  return { id: log.id };
}
```

### 3 — `AiSettingsService` + `AiSettingsController`

**New file: `apps/api/src/modules/ai/ai-settings.service.ts`**:

```ts
export interface AiSettingsSummary {
  summarizeEnabled: boolean;
  suggestReplyEnabled: boolean;
  categorizeEnabled: boolean;
  chatEnabled: boolean;
}

const DEFAULT_AI_SETTINGS: AiSettingsSummary = {
  summarizeEnabled: true,
  suggestReplyEnabled: true,
  categorizeEnabled: true,
  chatEnabled: true,
};

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getSettings(): Promise<AiSettingsSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const settings = await this.prisma.aiSettings.findUnique({ where: { branchId } });
    return settings ? toSummary(settings) : DEFAULT_AI_SETTINGS;
  }

  async updateSettings(dto: UpdateAiSettingsDto): Promise<AiSettingsSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const settings = await this.prisma.aiSettings.upsert({
      where: { branchId },
      create: {
        branchId,
        summarizeEnabled: dto.summarizeEnabled ?? true,
        suggestReplyEnabled: dto.suggestReplyEnabled ?? true,
        categorizeEnabled: dto.categorizeEnabled ?? true,
        chatEnabled: dto.chatEnabled ?? true,
      },
      update: {
        ...(dto.summarizeEnabled !== undefined ? { summarizeEnabled: dto.summarizeEnabled } : {}),
        ...(dto.suggestReplyEnabled !== undefined ? { suggestReplyEnabled: dto.suggestReplyEnabled } : {}),
        ...(dto.categorizeEnabled !== undefined ? { categorizeEnabled: dto.categorizeEnabled } : {}),
        ...(dto.chatEnabled !== undefined ? { chatEnabled: dto.chatEnabled } : {}),
      },
    });
    return toSummary(settings);
  }

  /** Consulted by `TicketAiService`/`AiChatService` before enqueueing.
   * Branch-scoped by an already-authorized caller's own `branchId` —
   * never re-derives tenant scope itself (mirrors every other
   * cross-service call in this codebase). */
  async isFeatureEnabled(
    branchId: string,
    feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT",
  ): Promise<boolean> {
    const settings = await this.prisma.aiSettings.findUnique({ where: { branchId } });
    if (!settings) {
      return true;
    }
    switch (feature) {
      case "SUMMARIZE":
        return settings.summarizeEnabled;
      case "SUGGEST_REPLY":
        return settings.suggestReplyEnabled;
      case "CATEGORIZE":
        return settings.categorizeEnabled;
      case "CHAT":
        return settings.chatEnabled;
    }
  }
}
```

**New file: `apps/api/src/modules/ai/dto/update-ai-settings.dto.ts`** —
four optional `@IsBoolean()` fields, mirroring `UpdateBrandingDto`'s
shape.

**New file: `apps/api/src/modules/ai/ai-settings.controller.ts`**:

```ts
@Controller("ai/settings")
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Get()
  @RequirePermissions("ai:read")
  getSettings(): Promise<AiSettingsSummary> {
    return this.aiSettingsService.getSettings();
  }

  @Patch()
  @RequirePermissions("ai:update")
  updateSettings(@Body() dto: UpdateAiSettingsDto): Promise<AiSettingsSummary> {
    return this.aiSettingsService.updateSettings(dto);
  }
}
```

**File: `apps/api/src/modules/ai/ai.module.ts`** — add `TenantContext` as
a provider (mirrors every feature module's own pattern), add
`AiSettingsService`/`AiSettingsController`, export `AiSettingsService`.
Update the file's own "Story 72 — foundation; no controller (still
true)" comment — no longer true.

### 4 — New permissions

**File: `apps/api/prisma/seed.ts`** — add `"ai:read"` and `"ai:update"`
to `PERMISSION_CATALOG` (anywhere in the list; alphabetical placement
near `"automation:*"` matches the file's existing loose grouping).
`ROLE_GRANTS.SuperAdmin: PERMISSION_CATALOG` picks them up automatically
— no other change needed. Re-run `pnpm prisma:seed` to reconcile the dev
database's `SuperAdmin` role.

### 5 — Gate the two call sites

**File: `apps/api/src/modules/tickets/ticket-ai.service.ts`** — inject
`AiSettingsService` into the constructor. In `submit()`, after computing
`branchId` (before creating the pending log):

```ts
if (!(await this.aiSettingsService.isFeatureEnabled(branchId, feature))) {
  const log = await this.aiGatewayService.createDisabledLog(
    feature as AiFeature,
    branchId,
    id,
    null,
    promptRef(input.subject, input.body),
  );
  return { id: log.id, outcome: "DISABLED" };
}
```

Widen `AiJobSubmittedResponse.outcome` to `"PENDING" | "DISABLED"`.

**File: `apps/api/src/modules/ai/ai-chat.service.ts`** — inject
`AiSettingsService`. In `sendMessage()`, after persisting the customer's
own `ChatMessage` (still always persisted regardless of the flag — only
AI *response generation* is gated) and before creating the pending log:

```ts
if (!(await this.aiSettingsService.isFeatureEnabled(session.branchId, "CHAT"))) {
  const log = await this.aiGatewayService.createDisabledLog(
    "CHAT",
    session.branchId,
    null,
    session.id,
    promptRef(session.id, body),
  );
  return { id: log.id, outcome: "DISABLED" };
}
```

Widen `sendMessage`'s return type to `{ id: string; outcome: "PENDING" |
"DISABLED" }`.

**Frontend type-honesty follow-through** (no behavioral change — neither
component branches on the submit response's `outcome` field, only its
`id`): widen `apps/web/src/lib/ticket-ai-api.ts`'s `submitAiOperation`
return type and `apps/portal/src/lib/chat-api.ts`'s `sendChatMessage`
return type the same way.

---

## Frontend Tasks (`apps/web` only — no `apps/portal` change)

### 6 — API client, hooks, page, nav entry

**New file: `apps/web/src/lib/ai-settings-api.ts`** — mirrors
`branding-api.ts` exactly: `AiSettingsSummary`/`UpdateAiSettingsInput`
types, `getAiSettings`/`updateAiSettings` calling `GET`/`PATCH
/ai/settings`.

**New file: `apps/web/src/hooks/use-ai-settings.ts`** — mirrors
`use-branding.ts` exactly: `aiSettingsQueryKey`, `useAiSettingsQuery`,
`useUpdateAiSettingsMutation` (invalidates on success).

**New file: `apps/web/src/components/admin/ai-settings-view.tsx`** —
mirrors `BrandingView`'s loading/error/form shape, but with four toggle
switches (or checkboxes, matching this codebase's existing form-control
vocabulary — no `Switch` component exists yet in `@/components/ui`, so a
plain labeled checkbox mirrors the simplest existing precedent) instead
of three text inputs. No "preview" panel (nothing to preview for a
boolean flag) — an `Alert` explaining the flag's own live effect stands
in its place, mirroring `BrandingView`'s own explanatory `description`
line under the title.

**New file: `apps/web/src/app/[locale]/(agent)/ai-settings/page.tsx`** —
mirrors `branding/page.tsx` exactly (a one-line wrapper).

**File: `apps/web/src/components/workspace/workspace-nav.tsx`** —
`ai-settings` appended as the new last `NAV_ITEMS` entry, same append
convention every prior addition has used.

**Files: `apps/web/messages/{en,ar}.json`** — new `aiSettings.*` keys
(title, description, error, retry, the four toggle labels, save/saving/
saveFailed), plus `workspace.nav.aiSettings`.

---

## Edge Cases & Failure Modes

- **A flag flipped mid-flight**: never retroactively cancels a `PENDING`
  job already enqueued — only the next `submit()`/`sendMessage()` call
  observes the new value. No new-tests-worthy behavior beyond "the check
  happens once, at submit time" (already covered by the unit tests
  below).
- **No `AiSettings` row for the branch (the common case today)**:
  `isFeatureEnabled` returns `true` for every feature — byte-for-byte the
  same behavior as every existing Story 73–75/80 test already asserts.
  This is why none of those prior e2e/unit suites need any change.
- **A disabled ticket-scoped feature**: `Ticket.category` is still never
  written (the `DISABLED` short-circuit returns before any
  category-related code runs) — the existing "categorize never mutates
  Ticket.category" invariant (Story 75) is unaffected.
- **A disabled chat message**: the customer's own message is still
  persisted as a `ChatMessage(CUSTOMER)` row (visible in the
  conversation), but no `ChatMessage(ASSISTANT)` row is ever created —
  identical to how Story 80 already handles a worker-side `ERROR`/
  `DISABLED` outcome, just reached synchronously instead.
- **Cross-branch isolation**: `isFeatureEnabled`/`getSettings`/
  `updateSettings` are all scoped by the caller's own `branchId` (via
  `TenantContext.requireBranchScope()` for the admin routes, and the
  already-resolved `branchId` the two call sites already have for the
  gate check) — one branch's admin can never see or change another
  branch's `AiSettings` row, mirroring `BrandingConfig`'s own isolation
  exactly.

---

## Test Plan

1. **`apps/api/src/modules/ai/ai-gateway.service.spec.ts`** — new
   `describe("createDisabledLog", ...)` block asserting the exact `data`
   object (`outcome: "DISABLED"`, `model: "disabled"`), mirroring
   `createPendingLog`'s own existing assertions.
2. **`apps/api/src/modules/ai/ai-settings.service.spec.ts`** (new) —
   mirrors `branding.service.spec.ts`'s exact shape: `getSettings`
   branch-scoping + all-true defaults + existing-row passthrough +
   `TenantContext` error propagation; `updateSettings` upsert-on-branch +
   partial-update + result mapping; `isFeatureEnabled` true-when-absent,
   and one case per feature reading the matching column, plus a case
   proving a different feature's `false` doesn't affect this one's
   result.
3. **`apps/api/src/modules/tickets/ticket-ai.service.spec.ts`** — new
   cases: when `isFeatureEnabled` resolves `false`, `submit()` calls
   `createDisabledLog` (not `createPendingLog`), never calls
   `aiProcessingProducer.enqueue`, and returns `{ id, outcome:
   "DISABLED" }`; when it resolves `true`, existing PENDING-path
   assertions are unchanged (update the DI-mock builder to include
   `AiSettingsService`, defaulting `isFeatureEnabled` to `true` so every
   pre-existing test keeps passing unmodified).
4. **`apps/api/src/modules/ai/ai-chat.service.spec.ts`** — same shape of
   new cases for `sendMessage`, plus a case confirming the customer's
   `ChatMessage` is still created even when the feature is disabled.
5. **`apps/api/test/tickets.e2e-spec.ts`** — new case in the existing
   "ticket AI summarization" describe block: `PATCH /ai/settings` with
   `summarizeEnabled: false`, then `POST /tickets/:id/ai/summarize`
   returns `{ id, outcome: "DISABLED" }` immediately, and no job appears
   on the real `ai-processing` queue (mirrors the existing "enqueues a
   real ai-processing job" test's own queue-inspection pattern, asserting
   the negative this time) — reset the flag back to `true` at the end of
   the test (or use a dedicated, isolated fixture branch/ticket) so it
   does not affect later tests in the same file.
6. **`apps/api/test/portal-chat.e2e-spec.ts`** — same shape: disable
   `chatEnabled` via `PATCH /ai/settings` (as the admin), send a message,
   confirm `{ id, outcome: "DISABLED" }` and that the message list still
   shows the customer's own message but never an assistant reply.
7. **New `apps/api/test/ai-settings.e2e-spec.ts`** — 401 unauthenticated;
   403 for an Agent-role user lacking `ai:read`/`ai:update`; `GET`
   returns all-true defaults before any `PATCH`; `PATCH` partial-updates
   and `GET` reflects it; cross-branch isolation is implicitly covered by
   this suite's single-branch fixture (mirrors `business-hours`/
   `branding` e2e suites' own established scope).
8. **`apps/web/src/hooks/use-branding.ts`-equivalent**: no dedicated spec
   needed (matches this codebase's own established precedent — trivial
   `useQuery`/`useMutation` wrappers are exercised via the component spec
   instead).
9. **`apps/web/src/components/admin/ai-settings-view.spec.tsx`** (new) —
   mirrors `branding-view.spec.tsx`'s shape: loading/error/retry, initial
   values reflect the fetched settings, toggling and saving calls the
   mutation with only the changed field(s), inline error on a rejected
   save.
10. **`apps/web/src/components/workspace/workspace-nav.spec.tsx`** —
    update the "eleven top-level screens" assertion to twelve, including
    `ai-settings`.

---

## Migration / Rollback

- Purely additive: one new table, one new nullable-by-absence-of-row
  branch config. No existing column altered or dropped.
- **Rollback:** drop `ai_settings`. Every feature reverts to
  always-enabled (the pre-Story-81 behavior) — safe, matches the
  absence-means-default convention exactly.
- **Half-applied state:** safe — old code never reads/writes the new
  table; new code's `isFeatureEnabled` degrades to "always true" if the
  table doesn't exist yet only in the sense that a migration must run
  before the new code path executes at all (standard Prisma-migration
  ordering, same as every prior story).

---

## Verification Steps

1. `pnpm prisma generate && pnpm --filter @crm/api typecheck`.
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or the same isolated-file fallback
   Stories 79/80 documented, if the sandbox's Prisma consent gate blocks
   `migrate reset --force` again).
4. `pnpm --filter @crm/web typecheck && pnpm --filter @crm/web lint && pnpm --filter @crm/web test`
5. `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (confirms
   `apps/worker`/`apps/portal` and every other untouched package remain
   unaffected).

---

## Done Criteria

- [ ] `AiSettings` exists via a real Prisma migration; `Branch.aiSettings`
      back-relation added.
- [ ] `GET`/`PATCH /ai/settings` exist, gated by new `ai:read`/
      `ai:update` permissions, absence-means-all-enabled, upsert on PATCH.
- [ ] `TicketAiService.submit` and `AiChatService.sendMessage` both
      consult the flag for their own feature and short-circuit to a
      synchronously-created `DISABLED` `AiPromptLog` row when off, never
      enqueueing `ai-processing` in that case.
- [ ] A disabled chat message still persists the customer's own
      `ChatMessage`; a disabled categorize still never mutates
      `Ticket.category`.
- [ ] The agent-facing `ai-settings` admin page exists and works.
- [ ] No `apps/portal` change; no change to
      `AnthropicAiProvider`/`NullAiProvider`/`packages/ai`/provider
      selection.
- [ ] Every item in `## Test Plan` is added/updated and passing.
- [ ] Every command in `## Verification Steps` passes.
- [ ] Every pre-existing test suite remains green, unweakened.
