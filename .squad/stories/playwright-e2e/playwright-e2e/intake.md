> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/playwright-e2e/playwright-e2e/intake.md`

---

## Feature

- **Feature name (display):** Browser E2E — Playwright critical-flow coverage
- **Feature slug (folder under `plans/`):** `playwright-e2e`

## Title

```text
Story 114 — Browser E2E: Playwright critical-flow coverage
```

## Description

```text
docs/architecture/11-quality-and-operations.md names Playwright browser
E2E as part of this project's intended test pyramid: "E2E tests use
Playwright for a small set of critical flows: an agent resolves a ticket
and a customer submits one through the portal." No such coverage existed
-- only API-level e2e (Vitest + Supertest against apps/api directly).
This story adds a new apps/e2e workspace package with exactly those two
Playwright specs, seeding fixture data through the real running API
(never a direct DB write) and driving the actual apps/web/apps/portal
UIs in a real browser (Chromium).
```

## Acceptance criteria

```text
- [ ] New apps/e2e workspace package (@crm/e2e), picked up by the
      existing apps/* pnpm-workspace glob.
- [ ] agent-resolves-ticket.spec.ts: agent signs in, opens a
      fixture-created ticket, resolves it.
- [ ] customer-submits-ticket.spec.ts: a fixture-created portal Contact
      signs in, submits a new ticket via the portal's inline form, sees
      it appear in the list.
- [ ] Both specs pass reliably in a full-suite run, not just in
      isolation.
- [ ] apps/e2e typechecks and lints cleanly.
- [ ] A new CI job runs this suite (disclosed as unverified by an actual
      CI run from this environment).
- [ ] Full existing monorepo verification cycle remains green.
```

## Dependencies

- Story 02 — monorepo scaffolding (`pnpm-workspace.yaml`'s `apps/*` glob).
- Story 06 — Identity & Access / auth (the seeded admin login this suite
  drives).
- Story 12 — Ticketing foundation (ticket creation/status transitions).
- Story 52/54 — Customer Portal auth + KB browsing (established
  `apps/portal` as a running, locale-routed Next.js app).
- Story 94 — Portal ticket submission + success toast (the inline
  "Submit a new ticket" form this suite drives).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- A general browser-testing framework covering every screen.
- Visual regression / screenshot-diffing.
- A cross-browser matrix (Chromium only).
- `apps/worker` involvement (neither named flow needs a worker-only async
  side effect to complete or be observable).
- Verifying the new CI job via an actual GitHub Actions run.
