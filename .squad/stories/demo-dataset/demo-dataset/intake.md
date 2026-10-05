> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/demo-dataset/demo-dataset/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Demo dataset
- **Feature slug (folder under `plans/`):** `demo-dataset`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-3.0**, global Story **215**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Demo dataset
```

---

## Description

```
Story 215 — PR-3.0 of the CRM product redesign (roadmap Phase 3;
decision PD-6: a dev-only, idempotent demo dataset).

GOAL
The board, the ticket workspace and the dashboard can be shown with data
that looks like a real support operation — instead of the dev database's
e2e fixtures ("Automation rules e2e ticket", "E2E Live Chat <uuid>").

CONTEXT
- apps/api/prisma/seed.ts: idempotent base seed (organization, branch,
  department, permission catalog, roles, one admin from SEED_ADMIN_*); it
  refuses a hard-coded password.
- Tickets created through Prisma bypass the API's listeners, so SLA
  targets and history must be written explicitly.
- The web SLA indicator governs by the earliest target (response).
- KB search_vector is a generated column (no app-side maintenance).

REQUIRED OUTCOME
1. prisma/seed-demo.ts + `pnpm --filter @crm/api prisma:seed:demo`.
2. A separate branch "Riyadh Support (Demo)" with a department, an admin
   and five agents (password from DEMO_USER_PASSWORD, refused if absent),
   14 customers with contacts (one with portal access).
3. ~120 tickets across statuses/priorities/categories with SLA targets
   relative to now (on-track / at-risk / breached / on-hold), history,
   conversations, notes, CSAT; 4 bilingual published KB articles.
4. Idempotent (deterministic ids + upserts); never touches other
   branches; never runs in CI.
```

---

## Acceptance criteria

```
- [ ] Two consecutive runs leave identical row counts.
- [ ] Active tickets spread over every SLA state.
- [ ] Demo users can sign in to web and portal; screens render (harness).
- [ ] api lint/typecheck green; no secrets committed.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none.
- **Depends on code areas or other stories:** the base seed.

## Extra notes (optional)

- The demo walkthrough (Story 235) documents how to load and present it.

## Technical hints (optional)

- Files: `apps/api/prisma/seed-demo.ts`, `apps/api/package.json`.

## Out of scope

- Schema changes, CI wiring, production seeding.
