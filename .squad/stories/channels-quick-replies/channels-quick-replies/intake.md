> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/channels-quick-replies/channels-quick-replies/intake.md`

---

## Feature

- **Feature name (display):** Communication/Channels — Quick Replies
- **Feature slug (folder under `plans/`):** `channels-quick-replies`

## Title

```text
Story 91 — Communication/Channels: Quick Replies
```

## Description

```text
docs/architecture/03-domain-boundaries.md's Communication/Channels row
names "channel configuration, inbound/outbound messages, threads, quick
replies" as the domain's owned concerns. Inbound/outbound messages shipped
(Story 77/85/87); quick replies never did. This story adds a branch-scoped
QuickReply model (title/body/isActive) in the channels schema, owned by
ChannelsModule (its first controller), a small branch-admin CRUD surface
(POST/GET/PATCH /quick-replies), a new agent-workspace admin page to
manage the list, and a picker inside the existing ticket chat composer
(TicketChatCard's ChatComposer, Story 78) that inserts a selected reply's
body into the draft message.
```

## Acceptance criteria

```text
- [ ] New QuickReply Prisma model (channels schema, branch-scoped,
      title/body/isActive), migration applied; Branch gains the
      quickReplies back-relation.
- [ ] quick-reply:create/read/update permissions added to
      apps/api/prisma/seed.ts's PERMISSION_CATALOG.
- [ ] New QuickRepliesService/QuickRepliesController in ChannelsModule:
      POST/GET/PATCH :id /quick-replies, branch-scoped, permission-gated,
      404 for a cross-branch or unknown id on PATCH.
- [ ] New apps/web/src/lib/quick-replies-api.ts,
      apps/web/src/hooks/use-quick-replies.ts,
      apps/web/src/components/quick-replies/quick-replies-view.tsx
      (table + inline add-form + activate/deactivate, mirroring
      AutomationRulesView's shape) and a new
      apps/web/src/app/[locale]/(agent)/quick-replies/page.tsx route,
      appended to WorkspaceNav's NAV_ITEMS.
- [ ] apps/web/src/components/tickets/ticket-chat-card.tsx's ChatComposer
      gains a quick-reply picker (active replies only) that inserts the
      selected body into the draft — replacing empty text, appending with
      a separator to non-empty text, never discarding what was typed.
- [ ] apps/web/messages/en.json and ar.json both gain a quickReplies
      namespace, a workspace.nav.quickReplies key, and a
      tickets.detail.quickReplyPlaceholder key, with no existing key
      modified.
- [ ] New quick-replies.service.spec.ts, quick-replies.e2e-spec.ts,
      quick-replies-view.spec.tsx; ticket-chat-card.spec.tsx extended for
      the new picker's insert/append behavior.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or its
      documented isolated-file fallback), pnpm --filter @crm/web test,
      pnpm typecheck, pnpm lint, and pnpm build all pass.
```

## Dependencies

- Story 77/78 — `customer-portal-live-chat` (`ChannelsModule`,
  `ChannelMessagesService`, `TicketChatCard`/`ChatComposer` — the exact
  module and composer this story extends).
- Story 57 — `sla-automation-rules` (`AutomationRulesService`/
  `AutomationRulesController`/`AutomationRulesView` — the exact
  branch-admin, arbitrary-list, `isActive`-toggle CRUD shape mirrored
  here).
- Story 61 — `notification-templates` (`NotificationTemplatesService` —
  the exact "no cross-entity validation" service shape mirrored here).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Variable interpolation / merge fields in a quick reply's body.
- Department-level scoping (branch-scoped only).
- Hard delete (soft `isActive` toggle only, matching every other resource
  in this codebase).
- Any Customer Portal (`apps/portal`) surface.
- Any relation to `TicketAiService.suggestReply` (an unrelated, per-ticket
  AI feature).
- "Channel configuration" and "threads" — the domain table's other two
  named nouns, both still speculative (see this feature's `00-overview.md`
  for the full reasoning).
