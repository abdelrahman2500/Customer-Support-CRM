# redesign-ticket-detail-workspace — plan overview

| NN  | Title | Depends on |
|-----|-------|------------|
| 156 | Redesign ticket detail workspace | 153 (labels), 154 (SectionCard available), 155 (QueryStateCard pattern) |

## What changed

Three things, all layout and presentation:

1. **Visible page identity.** The `sr-only` h1 + always-editable `Input` became a visible `h1` with an explicit Edit affordance. Same `PATCH`, same blur-commit, same revert-on-error; Escape now abandons an edit.
2. **Two-column workspace at `lg`.** Main column: conversation, AI assist, notes, attachments, KB references — everything an agent *writes*. Side column: metadata, customer context, SLA, escalations, history, CSAT — what they *read*. One column below `lg`, main first.
3. **Conversation height.** `max-h-80` (320px) → `min-h-[16rem] max-h-[60vh]`.

## Deliberately NOT done

- **No tabs.** Nothing is hidden; the order changed, not the content. The brief allowed tabs only if evidence favoured them, and nothing here did.
- **No chat pagination** — `listForTicket` is unbounded server-side, which is a backend concern and explicitly out of scope.
- **No API, permission, SLA, AI, escalation, CSAT, notes, attachment, KB or routing change.** The restructure moved JSX blocks verbatim; a guard test asserts every section survived.
