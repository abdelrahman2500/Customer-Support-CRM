# playwright-e2e — plan overview

Entry point for the **playwright-e2e** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 114 | [114-story-playwright-e2e.md](./114-story-playwright-e2e.md) | Browser E2E — Playwright critical-flow coverage | — | Story 02 (monorepo scaffolding), 06 (Identity/auth), 12 (Ticketing foundation), 52/54 (Portal auth + KB browsing established the portal app), 94 (portal ticket submission + toast) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 109 closed, from
  the standing, user-approved unblocked backlog (110 saved dashboards, 114
  Playwright E2E, 115 audit-log DB grants remaining at that point). 110 is
  a greenfield feature with materially higher design ambiguity (no
  widget/layout/sharing schema specified anywhere in `docs/architecture/**`).
  115 is a narrow, low-value DB-grant hardening task. 114 was prioritized
  under CLAUDE.md §2 priority 4 (**risk reduction**):
  `docs/architecture/11-quality-and-operations.md` explicitly names
  Playwright browser E2E as part of this project's intended test pyramid
  ("E2E tests use Playwright for a small set of critical flows: an agent
  resolves a ticket and a customer submits one through the portal"), and
  today only API-level e2e (`apps/api/test/*.e2e-spec.ts`, via Vitest +
  Supertest) exists — there is zero coverage of the actual browser-rendered
  `apps/web`/`apps/portal` UIs. That is a real, disclosed gap in this
  project's verification story, independent of any single product
  domain, so it outranked 110's greenfield feature work under the
  risk-reduction priority.
- **The gap**: confirmed directly — no `apps/e2e` (or equivalent) workspace
  package existed anywhere in the monorepo; `pnpm-workspace.yaml`'s
  `apps/*` glob was the only thing that would need to pick it up.
  `docs/architecture/11-quality-and-operations.md` names the exact two
  flows in scope; no other browser flow is called out anywhere in the
  architecture docs, so no other flow was added.
- **Why not externally blocked**: purely internal tooling/config work — no
  external provider/credential decision needed, unlike the
  deliberately-deferred Stories 116-123 (Communication/Channels needs a
  chosen email/WhatsApp/SMS provider).
- **Design decisions this story makes** (see the story doc's own Design
  section for full detail and rationale):
  - A new `apps/e2e` workspace package (`@crm/e2e`), not a `test/e2e`
    folder inside `apps/web` or `apps/portal` — the two named flows cross
    both frontend apps plus `apps/api`, so a dedicated top-level package
    that can drive all of them is the correct home, mirroring how
    `apps/worker` is its own package rather than living inside `apps/api`.
  - Fixture data (ticket/customer/contact) is seeded through the real,
    running `apps/api` HTTP API (a thin `fetch` helper,
    `tests/support/api-client.ts`), never a direct DB write — the same
    discipline `apps/api/test/*.e2e-spec.ts` already established, and it
    keeps each Playwright test focused on the one UI interaction it
    actually exists to verify.
  - Playwright's `webServer` starts `apps/api` (`pnpm --filter @crm/api
    dev`) and pre-built production servers for `apps/web`/`apps/portal`
    (`pnpm --filter @crm/web start` / `... @crm/portal start`), NOT
    `next dev` — see the story doc's Design section for the concrete,
    confirmed bug this avoids. `apps/worker` is deliberately not started.
  - `apps/api`'s own `.env` is loaded into an isolated object (never the
    ambient `process.env`) and passed only to the `apps/api` `webServer`
    entry, with `CORS_ORIGINS` overridden (in that isolated object only,
    never written back to the real `.env`) to also allow `apps/portal`'s
    origin — see the story doc's Design section for why both of these are
    necessary, not optional hardening.
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for the
  full list): exactly the two flows
  `docs/architecture/11-quality-and-operations.md` names — no general
  browser-testing framework, no visual regression, no cross-browser matrix
  (Chromium only, matching the doc's own "Playwright" mention with no
  further browser-matrix requirement), no CI run verification from this
  environment (disclosed as an explicit limitation).
