> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/ai-chat-escalation-to-ticket/ai-chat-escalation-to-ticket/intake.md`

---

## Feature

- **Feature name (display):** AI Services / Customer Portal / Ticketing
- **Feature slug (folder under `plans/`):** `ai-chat-escalation-to-ticket`

## Title

```text
Story 85 — AI Chat: Escalate to a Human Ticket
```

## Description

```text
Story 80 (AI Portal Chatbot) explicitly disclosed "Agent visibility:
explicitly none" as a deliberate non-goal. Today a portal customer
talking to the AI chatbot has no way to reach a human agent from that
conversation - the only paths to an agent are the unrelated "submit a
ticket" form (no context carried over) or ticket-scoped live chat (which
requires a ticket to already exist). This story adds a one-action
"escalate to a human agent" path from the chat widget: it creates a real
Ticket via the existing TicketsService.createTicketForContact (Story 53),
replays the chat transcript onto it as ordinary ChannelMessage rows (a
new ChannelType.AI_CHAT, Story 77's existing mechanism) so it appears
immediately in apps/web's existing TicketChatCard message thread with no
new agent-facing UI, and links the ChatSession to the new ticket via a
new escalatedTicketId column so re-escalating is idempotent.
```

## Acceptance criteria

```text
- [ ] POST /portal/chat/sessions/:id/escalate creates a ticket via
      TicketsService.createTicketForContact and returns { ticketId }.
- [ ] The ticket's subject is derived from the session's first CUSTOMER
      message (truncated to 120 chars).
- [ ] The full persisted transcript (CUSTOMER + ASSISTANT ChatMessage
      rows) is replayed onto the new ticket as ChannelMessage rows with
      channelType AI_CHAT, in order, with correct sender attribution
      (CUSTOMER -> senderContactId set; ASSISTANT -> no sender).
- [ ] Escalating a session with zero messages returns 400 and creates
      nothing.
- [ ] Escalating an already-escalated session is idempotent (returns the
      same ticketId, creates nothing new).
- [ ] A different Contact's session id, or a nonexistent session id, is
      masked as 404.
- [ ] apps/web's TicketChatCard correctly labels an AI_CHAT-channel,
      no-senderUserId OUTBOUND message as "AI Assistant", not "Agent".
- [ ] apps/portal's ChatWidget offers an escalate action once messages
      exist and navigates to the new ticket's detail page on success.
- [ ] No change to AnthropicAiProvider/NullAiProvider/packages/ai/
      ai-processing or any AI feature-flag logic.
- [ ] Backend and frontend unit tests plus a new e2e case cover the above.
- [ ] Typecheck, lint, build, and the relevant test suites pass.
```

## Dependencies

- Story 80 — `ai-portal-chatbot` (`ChatSession`/`ChatMessage`,
  `AiChatService`, `ChatWidget`)
- Story 53 — `customer-portal-ticket-submission-tracking`
  (`TicketsService.createTicketForContact`, `PortalTicketsService`)
- Story 77/78 — `customer-portal-live-chat` (`ChannelMessage`,
  `ChannelMessagesService`, `TicketChannelService`, `TicketChatCard`)

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Agent-initiated escalation, any agent-facing chat-session list/
  dashboard, or any change to `chat-session:{id}` realtime authorization.
- A live AI-to-agent hand-off signal; the AI chatbot session does not
  keep running after escalation.
- Any `$transaction`/interactive-transaction introduction.
- Any `apps/worker` change.
