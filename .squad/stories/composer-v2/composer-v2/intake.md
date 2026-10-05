> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked. 
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/composer-v2/composer-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Composer v2
- **Feature slug (folder under `plans/`):** `composer-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.7**, global Story **207**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `packages/ui`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Composer v2: modes and input correctness
```

---

## Description

```
Story 207 — RD-3.7 "Composer v2: modes and input correctness" of the CRM
UI/UX redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md
Phase 3 "RD-3.7"; recon TW-04, A11Y-05, A11Y-09).

GOAL
One composer for the ticket: an agent picks Reply or Internal note, types
(in any script, including with an Arabic IME) and sends with Enter, without
losing focus, their draft, or the ability to mention a colleague by
keyboard.

CONTEXT (verified at HEAD c9ef100)
- ticket-chat-card.tsx: ChatComposer (reply) — quick-reply Select, Textarea
  (aria-label = placeholder "Type a message...", disabled while sending),
  "Send by email" checkbox when the EMAIL adapter is configured (RM-15),
  Enter sends / Shift+Enter newline (no isComposing guard), errors inline
  (forbidden / network / chatSendFailed). Story 206 added a `noteComposer`
  slot below it.
- ticket-detail-view.tsx: AddNoteForm (Story 50 + RM-06) — Textarea
  (aria-label = placeholder), "Add note" button, @mention: trailing "@word"
  at a word boundary → up to 5 matching users in a plain <ul> of buttons
  (no listbox/option/activedescendant/arrow keys — A11Y-05); Escape
  dismisses; picking inserts "@Full Name ".
- Placeholder-as-name and focus lost after send (disabled textarea): A11Y-09.
- Kbd primitive (Story 189); Tabs (with `dir`, Story 206); Combobox listbox
  styling (Story 204, lib/menu.ts menuItemClassName).
- Playwright live-chat sendChatMessage uses getByLabel("Type a message...")
  on both the web and portal pages.

REQUIRED OUTCOME
1. packages/ui Composer shell: textarea + toolbar + footer + submit; Enter
   submits unless Shift or IME composition (isComposing / keyCode 229 /
   compositionstart..end); the textarea is never disabled while pending
   (submit is), and focus returns to it after a submit; optional inline
   suggestions in the ARIA combobox pattern (textarea role=combobox,
   aria-expanded/controls/activedescendant, listbox/options, Arrow keys,
   Enter/Tab pick, Escape dismiss); tone "note".
2. Web TicketComposer replaces ChatComposer + AddNoteForm: Reply / Internal
   note mode tabs (dir-aware), each mode with its own accessible name
   (not the placeholder), placeholder, submit label, error copy and
   mutation (messages / notes — payloads unchanged); reply keeps quick
   replies and "Send by email" exactly; note keeps the RM-06 mention rules
   on the shell's suggestions; note mode is tinted and says only agents see
   it; a visible Kbd hint; a sessionStorage draft per ticket and mode;
   sticky at the bottom of the conversation card.
```

---

## Acceptance criteria

```
- [ ] An Enter during IME composition never sends (spec with composition
      events and isComposing).
- [ ] The textarea stays enabled during send and focused after it (spec).
- [ ] The mode is announced (tabs + per-mode accessible name) (spec).
- [ ] Mentions are keyboard-operable with listbox semantics (spec); the
      RM-06 insertion/boundary/Escape rules unchanged.
- [ ] "Send by email", quick replies and both payloads unchanged (existing
      specs, selectors updated with reasons).
- [ ] Drafts survive a remount per ticket and mode and clear on send (spec).
- [ ] Playwright live-chat green; web/ui tests, typecheck, lint, build;
      harness 320/768/1280 × en/ar × light/dark, 0 overflow.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.7 depends on RD-3.4, RD-3.6.
- **Depends on code areas or other stories:** Stories 50, 78, 91, 189, 204, 206; RM-06, RM-15.

## Extra notes (optional)

- Send-and-set-status is out of scope (roadmap NG, §12). Attach / KB link / AI insert are RD-3.8.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/composer.tsx` (+spec, index), `ticket-chat-card.tsx` (+spec), `ticket-detail-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`, `apps/e2e/tests/agent-customer-live-chat.spec.ts` (helper selector only).

## Out of scope

- The portal composer (RD-5.4), composer tools (RD-3.8), send-and-set-status, any backend change.
