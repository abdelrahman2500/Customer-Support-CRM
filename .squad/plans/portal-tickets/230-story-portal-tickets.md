# Story 230 — Portal tickets

> CRM product redesign roadmap item **PR-5.2**. Intake: [`../../stories/portal-tickets/portal-tickets/intake.md`](../../stories/portal-tickets/portal-tickets/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 5.

## Prerequisites

Stories 205, 207, 208, 229.

## Story Goal

The portal's ticket list and ticket page speak the product's visual language and use its shared conversation parts.

**Non-goals:** reopening tickets; new endpoints.

## Design decisions

1. **List** — `PageHeader` (title, description, fetch indicator in actions); `lg:grid-cols-3`: list card (`lg:col-span-2`, h2 `list.allHeading`) and the create card (`lg:order-last`, first on a phone — Story 157 kept). Rows become `TicketCard`s (moved out of the home view; `toneSpine().start`), replacing the row click handler.
2. **Create** — `FormField` comfortable, subject `required` (marker), category hint; on success toast, clear, and `router.push` to `/tickets/{id}` when the response carries an id.
3. **Detail** — header `Card` with `border-t-[3px]` + `spine.top`, four facts (status, priority, category, opened); `CLOSED` → info Alert with a "Raise a new ticket" link to `#new-ticket`; CSAT (accent inline-start edge) right under the header when resolved/closed; `lg:grid-cols-3` body: conversation (2) and an aside with attachments and history. Skeleton reshaped to match.
4. **Conversation** — `MessageThread` (`role="log"`, named "Conversation"), `MessageBubble` (You/Agent avatars, delivery status), `Composer` (labelled field, hint, Enter sends, field never disabled).
5. **Attachments** — `FileDropzone` (area) with a `role="status"` uploading line.
6. **e2e** — the live-chat spec's `conversation()` locator drops its portal-only fallback.

## Tasks

1. `ticket-card.tsx`; list, detail, chat and attachments cards; messages (en/ar; `detail.chatHeading` → Conversation).
2. Specs: list (required-marker label, card link name, heading order, navigate, spine), chat (Composer label, pending semantics), detail (spine, closed hint, feedback order).

## Verification Steps

1. portal vitest, typecheck, lint, build; Playwright full suite.
2. Harness: list and IN_PROGRESS/RESOLVED/CLOSED details at 390/1280 × en light / ar dark; home → `#new-ticket` lands on the form.

## Done Criteria

- [ ] List, create, detail, conversation, attachments; suites green.
