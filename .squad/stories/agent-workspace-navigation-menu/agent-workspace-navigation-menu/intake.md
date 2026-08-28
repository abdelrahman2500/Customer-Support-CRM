> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-navigation-menu/agent-workspace-navigation-menu/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Persistent Navigation Menu

- **Feature slug (folder under `plans/`):** `agent-workspace-navigation-menu`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Agent Workspace — Persistent Navigation Menu
```

---

## Description

```text
A multi-agent Next-Story recon (after Story 43) found that every purely frontend, backend-ready, zero-decision story had been exhausted — every backend-accepted DTO field is now consumed, and the one remaining zero-backend candidate was a persistent workspace navigation menu, previously deferred by every Agent Workspace story's plan since Story 23 ("no persistent cross-screen navigation menu... consistent with how every existing screen is already reached via a specific in-page button or a direct URL").

A product decision (recorded prior to this intake) explicitly reverses that deferral: the navigation menu is now an approved product capability, scoped to the nine already-implemented, already-URL-reachable Agent Workspace screens. This story adds it, extending the one existing `WorkspaceNav` component with a row of plain links — no new backend endpoint, no new client-side authorization logic (confirmed during planning that no such pattern exists anywhere in this codebase and the seeded `Agent` role has zero permissions to key one off), no active-page highlighting (confirmed zero precedent for `usePathname`/`aria-current` anywhere in the app).
```

---

## Acceptance criteria

```text
- Every one of the nine top-level Agent Workspace screens (dashboard, tickets, customers, sla-policies, business-hours, users, roles, audit-logs, notifications) has a persistent link in the workspace chrome, visible on every authenticated page.
- Each link navigates to its correct, entirely unchanged, existing route.
- The existing app-name link and sign-out behavior (Story 41) are completely unchanged.
- No link is conditionally hidden based on the current user's role/permissions — all nine always render; a screen the current session lacks permission for renders its own existing 403/forbidden state after navigation, exactly as it already does today when reached by direct URL.
- No active-page highlighting is introduced.
- No new backend endpoint, DTO field, permission, Prisma model, migration, or authorization logic.
- No change to `(agent)/layout.tsx` or any individual screen's own component/page file.
- No README change.
- English and Arabic translations exist for every new string, matching each screen's own already-established title wording exactly; RTL preserved via gap-based spacing (no directional margins).
- Component tests cover: a link per screen with the correct href, and confirmation that the existing app-name/signed-in-as/sign-out elements and behavior are unchanged.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** every existing top-level Agent Workspace screen (Stories 23, 26, 28, 31, 32, 33, 34, 38, 39, 40) — all already implemented and routed; this story only links to them, touching none of their own files.

- **Depends on code areas or other stories:** none inside `apps/api` — zero backend files touched. Touches exactly `apps/web/src/components/workspace/workspace-nav.tsx` (+its spec) and `apps/web/messages/{en,ar}.json`.

## Extra notes (optional)

- This story is the direct output of an explicit product decision made after a five-track parallel recon; it does not re-litigate that decision, and does not itself decide the next major post-navigation product phase (Customer Portal/Channels, Admin self-service, Automatic assignment, Agent Dashboard depth, Reports, Knowledge Base/AI) — per explicit instruction, that decision follows its own fresh recon after this story closes.
- **No README changes** — per explicit product instruction, the README's pre-existing drift (stale "through Story 32" state, the now-factually-false "Known gap: Story 31" note) is deliberately left for a future documentation-capable story, not folded into this one.
- Confirmed via fresh inspection this planning pass: the seeded `Agent` role has zero granted permissions (`apps/api/prisma/seed.ts`), so as the repository stands today, an Agent-role user would see a 403 on all nine linked screens' primary data fetch — a pre-existing seed-data characteristic, not something this story creates or must fix.

## Technical hints (optional)

- `WorkspaceNav` (`apps/web/src/components/workspace/workspace-nav.tsx`) currently returns a single `<header>`; this story wraps the return in a Fragment and adds a sibling `<nav>` row — confirmed `(agent)/layout.tsx` needs no change since it only renders `<WorkspaceNav user={user} />` inside an existing flex-col container.
- Every existing internal navigation link in this codebase is a plain `<a href=...>`, never `next/link`'s `<Link>` — confirmed via a full search of `apps/web/src`. This story's new links follow that exact convention.
- Each of the nine nav labels reuses the exact existing English/Arabic wording already established by that screen's own title key (e.g. `tickets.list.title`, `roles.title`) — confirmed by direct lookup, not translated fresh.

## Out of scope

- Any backend change, any new endpoint, any new permission, any new Prisma model.
- Client-side permission-aware showing/hiding of nav links; active-page highlighting; a responsive hamburger/drawer navigation pattern.
- Any change to `(agent)/layout.tsx`, any individual screen, or any backend file.
- README changes of any kind.
- Deciding or starting the next major product phase.
