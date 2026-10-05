> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked. 
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ai-assist-panel/ai-assist-panel/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** AI assist panel
- **Feature slug (folder under `plans/`):** `ai-assist-panel`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.9**, global Story **209**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
AI assist panel
```

---

## Description

```
Story 209 — RD-3.9 "AI assist panel" of the CRM UI/UX redesign track
(roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md Phase 3 "RD-3.9";
recon TW-06).

GOAL
AI assist sits beside the conversation as a tool, tells a screen-reader
user when a result is ready (or failed), and its latest summary stays
pinned at the top of the timeline where the agent reads.

CONTEXT (verified at HEAD 792a1c3)
- TicketAiCard (Story 79, RM-00, Story 208): SectionCard "AI Assist" in the
  main column under the conversation; four actions (Summarize / Suggest
  Reply / Categorize / Suggest Solutions) with one shared submit mutation
  and a per-button loading state; the latest operation's result is polled
  (PENDING → SUCCESS / ERROR / DISABLED); CATEGORIZE "Use as category"
  (view: match → PATCH categoryId, else the aiCategoryNoMatch Alert with a
  link); SUGGEST_REPLY "Insert into reply" (Story 208).
- Transitions are not announced: the result is a plain <p>, PENDING a plain
  <p>; only the ERROR Alert (role=alert) interrupts (TW-06).
- The inspector (Story 203): Properties, Customer context, SLA, CSAT —
  collapsible SectionCards.
- TicketChatCard (Stories 205–208): the timeline (filter tabs + thread) and
  the composer.

REQUIRED OUTCOME
1. The AI card moves into the inspector as a collapsible section (after
   Properties), with the category no-match Alert beside it.
2. A persistent polite live region (sr-only) announces each operation's
   state: "{feature}: working on it", "{feature} is ready", "{feature}
   failed", and the disabled message.
3. The latest successful Summarize result is pinned, collapsible, at the
   top of the conversation timeline (client state only; replaced by the
   next summary).
4. All four actions, the per-button loading state, Use as category, Insert
   into reply and the DISABLED state are unchanged.
```

---

## Acceptance criteria

```
- [ ] PENDING → SUCCESS / ERROR / DISABLED transitions are announced
      through a live region present from mount (spec).
- [ ] A successful summary is pinned and collapsible at the top of the
      timeline; a new summary replaces it (spec).
- [ ] All four actions, Use as category and the DISABLED state preserved
      (existing AI card specs green).
- [ ] The AI section is in the inspector, open by default, collapsible.
- [ ] Specs, typecheck, lint, build, Playwright; harness 320/768/1280 ×
      en/ar × light/dark with 0 overflow.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.9 depends on RD-3.6, RD-3.8.
- **Depends on code areas or other stories:** Stories 79, 203, 206, 208.

## Extra notes (optional)

- Persisting results and new AI actions are out of scope (roadmap NG).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `ticket-ai-card.tsx` (+spec), `ticket-chat-card.tsx` (+spec), `ticket-detail-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`.

## Out of scope

- Persisting results, new AI actions, any backend change.
