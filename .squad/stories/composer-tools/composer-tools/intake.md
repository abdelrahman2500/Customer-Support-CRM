> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked. 
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/composer-tools/composer-tools/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Composer tools
- **Feature slug (folder under `plans/`):** `composer-tools`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.8**, global Story **208**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `packages/ui`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Composer tools
```

---

## Description

```
Story 208 — RD-3.8 "Composer tools" of the CRM UI/UX redesign track
(roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md Phase 3 "RD-3.8";
recon A11Y-02, TW-06, TW-12).

GOAL
The tools an agent reaches for while replying sit in the composer: attach a
file, pick a quick reply by searching, and drop an AI-suggested reply into
the draft — each accessible, and none of them ever sending on its own.

CONTEXT (verified at HEAD 90f0bf5)
- AttachmentsCard (web, Story 66/67; used by the ticket, customer and KB
  article views): a bare <input type="file"> inside an unlabelled <label>
  (no accessible name — A11Y-02); single-file upload via
  useUploadAttachmentMutation(owner) → POST multipart "file" (one file per
  request); list invalidated on success.
- Ticket attachments are ticket-level and visible to the customer in the
  portal (apps/portal ticket-attachments-card) — there is no message-level
  attachment link (roadmap NG).
- TicketComposer (Story 207): quick replies are a Radix Select
  ("w-full sm:w-64"); insert into an empty draft, else append after a blank
  line.
- TicketAiCard: SUGGEST_REPLY result shows outputText only; CATEGORIZE has
  "Use as category" (TW-06: no way to use a suggested reply).
- KB references card lists attached articles (title + articleId). The web
  app has no configured portal origin (no PORTAL_URL / NEXT_PUBLIC_* env),
  so a customer-facing article link cannot be built.
- Combobox primitive (Story 204).

REQUIRED OUTCOME
1. packages/ui FileDropzone: a labelled file control (input named by
   `label`, hint as description), "area" (drop target) and "button"
   variants, single file, drag state, disabled/pending, focus ring on the
   wrapper; AttachIcon (Paperclip) in the icon vocabulary.
2. AttachmentsCard adopts it (area) for all three owners — new strings
   `uploadLabel` / `dropHint` in each caller's namespace.
3. Composer Reply mode: an "Attach file" button (FileDropzone button)
   uploading to the ticket's attachments through the same hook; uploading,
   success ("added to the ticket's attachments") and error states. Not in
   Internal note mode — ticket attachments are visible to the customer.
4. Quick replies: a searchable Combobox (same insert/append rule).
5. AI Suggest reply: "Insert into reply" — appends to the reply draft with
   the same insert/append rule, switches the composer to Reply and focuses
   it; never sends.
6. "Insert KB link": DEFERRED — needs a configured portal origin.
```

---

## Acceptance criteria

```
- [ ] Every web file input has an accessible name (spec); drop uploads the
      first file; upload payload unchanged.
- [ ] Quick-reply insertion (insert vs append) unchanged, now searchable.
- [ ] AI insert fills the reply draft and never sends (spec).
- [ ] Attach is offered only in Reply mode.
- [ ] Specs, typecheck, lint, build, Playwright live-chat; harness
      320/768/1280 × en/ar × light/dark with 0 overflow.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.8 depends on RD-3.7.
- **Depends on code areas or other stories:** Stories 66, 67, 79, 91, 204, 207.

## Extra notes (optional)

- Drag-drop multi-file is out: the endpoint takes one file per request (verified).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/file-dropzone.tsx` (+spec, index, icons), `attachments-card.tsx` (+spec), `ticket-chat-card.tsx`, `ticket-ai-card.tsx`, `ticket-detail-view.tsx`, `customer-detail-view.tsx`, `article-detail-view.tsx` (strings only), `apps/web/messages/{en,ar}.json`.

## Out of scope

- Message-level attachments, multi-file upload, "Insert KB link" (deferred), the portal attachments card (RD-5.x), any backend or config change.
