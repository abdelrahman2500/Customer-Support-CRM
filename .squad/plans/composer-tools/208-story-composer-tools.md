# Story 208 — Composer tools

> CRM UI/UX redesign roadmap item **RD-3.8**. Intake: [`../../stories/composer-tools/composer-tools/intake.md`](../../stories/composer-tools/composer-tools/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3 "RD-3.8"; recon A11Y-02, TW-06, TW-12.

---

## Prerequisites

- Story 207 (`Composer`, `TicketComposer`), Story 204 (`Combobox`), Stories 66/67 (`AttachmentsCard`), Story 79 (`TicketAiCard`).
- **Recon at Story start (done):**
  - The upload endpoint is **single-file**: `FormData` with one `"file"`, one request per file, so there is no multi-file drop.
  - Ticket attachments are **ticket-level** and visible to the customer in the portal.
  - The web app has **no portal origin** configured.

---

## Story Goal

The reply tools live in the composer: attach a file, search quick replies, and insert an AI-suggested reply. All three are accessible, and none of them sends anything.

The file controls get an accessible name everywhere in the web app (A11Y-02).

**Non-goals:**
- **"Insert KB link": deferred.** A customer-facing article link needs the portal's origin, which the web app does not have; adding it is deployment configuration, outside Phase 3.
- message-level attachments; multi-file upload;
- the portal attachments card (RD-5.x);
- any backend or config change.

---

## Design decisions

1. **`@crm/ui` `FileDropzone`** (`"use client"`).
   - **Props:** `label` (visible, and the input's `aria-label`), `hint?` (the input's `aria-describedby`; area variant only), `onFile(file)`, `variant: "area" | "button"`, `disabled`, `accept?`, `className`.
   - **Markup:** a `<label>` wraps a `sr-only` `<input type="file">`, so a click or Enter/Space anywhere on it opens the picker. The focus ring is on the wrapper via `has-[:focus-visible]:` with the same ring tokens as `.focus-ring`.
   - **Area:** `rounded-control border border-dashed border-rule-strong p-4 text-center`. While dragging over, `border-accent bg-accent-surface`. Drop takes the **first** file; drag-over uses `preventDefault`.
   - **Button:** the outline `sm` button look (`buttonVariants`) with `AttachIcon`.
   - **Selection:** the input value is reset after each pick, so the same file can be picked again; nothing happens when disabled.
   - **Icon:** `AttachIcon` (lucide `Paperclip`) joins the icon vocabulary.
2. **`AttachmentsCard`**:
   - `AddAttachmentForm` renders `<FileDropzone variant="area" label={strings.uploadLabel} hint={strings.dropHint} disabled={pending}>`; the upload, error and "Uploading" text are unchanged.
   - `AttachmentsCardStrings` gains `uploadLabel` and `dropHint`; all three callers pass them from their own namespace (`tickets.detail`, `customers.detail`, `knowledgeBase.detail`): `attachmentsUploadLabel` "Attach a file" / "إرفاق ملف" and `attachmentsDropHint` "or drop it here" / "أو أفلته هنا".
3. **Composer Reply mode toolbar:** a row holding the quick-reply `Combobox` and an "Attach file" `FileDropzone variant="button"`.
   - The button uploads through `useUploadAttachmentMutation({ type: "ticket", id })`, the same hook and cache key, so the Attachments card refreshes.
   - **Status** (`role="status"`):
     - pending: `detail.attachmentsUploading`;
     - success: `detail.composerAttached` ("{filename} was added to the ticket's attachments." / "تمت إضافة {filename} إلى مرفقات التذكرة.");
     - error: `errorMessage(…, {forbidden: actionForbidden, generic: attachmentsUploadFailed})` in an Alert.
   - **Only in Reply mode:** ticket attachments reach the customer, so they never sit under "Internal note".
4. **Quick replies:** a `Combobox`:
   - options: `{ value: id, label: title }` of the active replies; `value=""` (an action, not a selection);
   - `aria-label` and `placeholder` `detail.quickReplyPlaceholder`; `searchLabel` `detail.quickReplySearch` ("Search quick replies"); `emptyText` `detail.quickReplyNoMatch` ("No quick replies match.");
   - `className="w-full sm:w-64"`;
   - `onValueChange` → the unchanged `insertQuickReply`.
5. **AI "Insert into reply":**
   - `TicketAiCard` gets an `onInsertReply?(text)` prop. For a successful `SUGGEST_REPLY` with text, it shows a `Button size="sm"` labelled `detail.aiInsertIntoReply` ("Insert into reply" / "إدراج في الرد").
   - The view keeps `replyInsertion: { text: string; id: number } | null` and passes `onInsertReply={(text) => setReplyInsertion({ text, id: Date.now() })}` to the AI card and `replyInsertion` to `TicketChatCard` → `TicketComposer`.
   - On a new `id`, the composer:
     - switches to Reply;
     - applies the quick-reply rule (insert into an empty draft, else append after a blank line);
     - focuses the reply field (`Composer` gains a `fieldRef` prop, merged with its own ref).
   - Nothing is sent.
6. **Messages:** the keys above, en/ar, in the namespaces named.

---

## Context — Read These Files First

1. `apps/web/src/components/attachments/attachments-card.tsx` (+ spec) and its three callers.
2. `apps/web/src/components/tickets/ticket-chat-card.tsx`: `TicketComposer`.
3. `apps/web/src/components/tickets/ticket-ai-card.tsx` (+ spec).
4. `packages/ui/src/components/{composer,combobox,button}.tsx`, `packages/ui/src/lib/icons.ts`.

---

## Tasks

1. **ui:**
   - `file-dropzone.tsx` (+ spec: accessible name and description, change → `onFile` and reset, drop → first file, drag state, disabled, button variant);
   - `AttachIcon` (+ icons spec);
   - `Composer` `fieldRef` (+ spec case).
2. **`AttachmentsCard`:** adopt `FileDropzone`, extend the strings, update the 3 callers and messages.
3. **`TicketComposer`:** the toolbar with Combobox and attach; the insertion effect.
4. **`TicketAiCard`:** `onInsertReply`. **View:** wire the state.
5. **Specs:**
   - **attachments-card:** the file input is found by its label instead of `querySelector` (an equal assertion), plus new cases for the name and for drop;
   - **chat card:** the quick-reply cases go through the Combobox (same insert/append assertions); new cases for attach (payload, status, not in note mode) and insertion;
   - **AI card:** insert shown only for `SUGGEST_REPLY`, calls back with the text;
   - **detail and customer views:** `querySelector('input[type="file"]')` becomes the card's input by label, because the composer now has a file input first in the DOM; the reason is recorded;
   - **detail view:** an AI insert → reply draft case, which also asserts nothing is sent.

---

## Verification Steps

1. ui and web tests, typecheck and lint; prettier only on files clean at HEAD.
2. Web build; Playwright `agent-customer-live-chat` and `agent-resolves-ticket`.
3. Harness, 320/768/1280 × en/ar × light/dark:
   - the composer toolbar (attach button named, quick-reply Combobox if any are active), the Attachments card dropzone named, the focus ring on Tab;
   - 0 overflow;
   - no uploads or sends live.
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] `FileDropzone` + `AttachIcon` in `@crm/ui`, with specs; every web file input is named.
- [ ] Composer: attach (Reply mode only), searchable quick replies (same rule), AI insert without auto-send.
- [ ] "Insert KB link" deferred and documented (needs a portal origin).
- [ ] Specs, build, Playwright and harness green.
