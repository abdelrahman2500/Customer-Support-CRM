# Story 114 — Browser E2E: Playwright critical-flow coverage

## Goal

Add real, browser-driven end-to-end coverage for the two critical flows
`docs/architecture/11-quality-and-operations.md` names explicitly: "an
agent resolves a ticket and a customer submits one through the portal."
Today's `apps/api/test/*.e2e-spec.ts` suite exercises the API directly
(Vitest + Supertest) but never renders or interacts with the actual
`apps/web`/`apps/portal` UIs — this story closes that gap with a real
browser (Playwright/Chromium).

## Non-goals

- Not a general browser-testing framework for every screen — exactly the
  two named flows, nothing more (no settings screens, no KB browsing, no
  live chat, etc.).
- No visual regression / screenshot-diffing.
- No cross-browser matrix — Chromium only, matching the architecture doc's
  own unqualified "Playwright" mention with no further browser-matrix
  requirement.
- No `apps/worker` involvement — neither named flow depends on an async,
  worker-only side effect (SLA timers, AI processing) to complete or be
  observable in order to pass.
- No verification of this story's new CI job by an actual GitHub Actions
  run — this environment cannot execute one; the job is written to mirror
  the existing `build-and-test` job's proven patterns (service containers,
  migrate+seed) as closely as possible, and this limitation is disclosed
  explicitly in the completion report.

## Design

### Package layout

New workspace package `apps/e2e` (`@crm/e2e`), picked up automatically by
the existing `apps/*` glob in `pnpm-workspace.yaml`. A dedicated top-level
package — not a `test/e2e` folder inside `apps/web` or `apps/portal` —
because the two named flows span `apps/web`, `apps/portal`, and `apps/api`
together; this mirrors `apps/worker` already being its own package rather
than living inside `apps/api`.

- `package.json` — devDependencies only (`@playwright/test`, `dotenv`,
  `typescript`, `eslint`, `globals`, `@types/node`, `@crm/config`
  workspace dep for the shared `tsconfig`). Scripts: `test`, `test:ui`,
  `lint`, `typecheck`.
- `tsconfig.json` — extends `packages/config/tsconfig.library.json`,
  matching every other package.
- `eslint.config.js` — mirrors `apps/worker/eslint.config.js`.
- `playwright.config.ts` — see below.
- `tests/support/api-client.ts` — a thin `fetch`-based helper seeding
  fixture data (ticket/customer/portal-contact) directly against the real,
  running `apps/api`, mirroring `apps/api/test/*.e2e-spec.ts`'s own
  "seed via the real API/DB setup, then test one thing" discipline. Keeps
  each spec focused on the one UI interaction it exists to verify rather
  than also driving ticket/customer-creation forms already covered by
  unit and API-e2e tests.
- `tests/agent-resolves-ticket.spec.ts` / `tests/customer-submits-ticket.spec.ts`
  — the two named flows.

### `playwright.config.ts` — three debugging discoveries baked into its design

1. **Env-var leak → port collision.** `apps/api`'s own `.env`
   (`DATABASE_URL`/`REDIS_URL`/`JWT_*`/`SEED_ADMIN_EMAIL`/
   `SEED_ADMIN_PASSWORD`/`PORT`) must be available to the `apps/api`
   `webServer` entry. Loading it into the *ambient* process environment
   (e.g. `source .env` in the invoking shell, or `dotenv.config()`'s
   default of writing into `process.env`) was tried first and leaks
   `PORT=3001` into every spawned child process — including `apps/web`'s
   and `apps/portal`'s own Next.js servers, which also honor a `PORT` env
   var absent an explicit `-p`/`start -p` flag, so both then tried to bind
   port 3001 and failed with `EADDRINUSE` (confirmed while first
   authoring this config). Fixed by loading `.env` via `dotenv`'s
   `config({ path, processEnv: apiEnv })` into an isolated plain object,
   passed only to the `apps/api` `webServer` entry's own `env` field.
   `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are additionally copied onto
   the real `process.env` (nothing else) because `tests/support/api-client.ts`
   itself — which runs in Playwright's own top-level test-runner process,
   not a spawned child — needs to read them, exactly like
   `apps/api/test/*.e2e-spec.ts` already do.
2. **`next dev`'s on-demand compilation racing client-side navigation.**
   Both specs initially failed silently after a verified-correct login
   (200 response, correct JSON body, correctly-set non-httpOnly session
   cookie) — the page simply never navigated away from `/login`, always
   coinciding with a `[Fast Refresh] rebuilding` console message.
   Root-caused to `next dev`'s per-route, on-demand compilation racing
   with the app's own immediate `router.push()` right after a successful
   login, intermittently swallowing the navigation — a `next dev`-mode
   -specific class of flakiness. Fixed by using `apps/web`'s/`apps/portal`'s
   pre-built production server (`next start`, via each app's own `start`
   script) instead of `next dev` for Playwright's `webServer` entries —
   also a closer match to what a real deployment actually runs. Requires
   `pnpm --filter @crm/web build` / `pnpm --filter @crm/portal build` to
   already have completed (documented in this story's CI job and this
   package's own comments).
3. **CORS origin mismatch for the portal's own origin.** After fix #2,
   `agent-resolves-ticket.spec.ts` passed but `customer-submits-ticket.spec.ts`
   still failed identically ("stuck on /login") — a different root cause:
   a typical local `apps/api/.env` only lists `apps/web`'s own origin
   (`CORS_ORIGINS="http://localhost:3000"`), so the portal's
   (`http://localhost:3002`) login `fetch` was silently CORS-blocked by
   the browser. Fixed by overriding `CORS_ORIGINS` to include both origins
   within the isolated `apiEnv` object passed to the `apps/api` `webServer`
   entry only — never written back to the real `.env` file, so a
   developer's own local dev config is unaffected.

`workers: 1`, `fullyParallel: false` — both flows create their own
disposable fixture data and don't share mutable state, but keeping the
suite serial avoids adding parallel-run flakiness risk for a first version
of this package with only two specs (revisit if the suite grows enough for
serial runtime to matter).

### Fixture-data collision (found and fixed during verification)

`tests/support/api-client.ts`'s `createTicketAsAdmin` originally built its
throwaway Customer's `displayName` as `` `Playwright fixture customer
${subject}` `` — embedding the ticket's own random subject string
verbatim. `apps/web`'s ticket list page renders both a ticket's subject
and its customer's display name in the same row, so
`agent-resolves-ticket.spec.ts`'s `page.getByText(subject).click()`
intermittently matched *two* elements (the subject cell and the customer
name button containing the same substring) — a Playwright strict-mode
violation, observed during a full-suite run despite the same spec passing
in isolation moments earlier. Fixed by giving the fixture Customer its own,
independent random id instead of reusing `subject` — the two pieces of
fixture text no longer overlap, regardless of how the table renders them.

## Acceptance criteria

- [x] New `apps/e2e` workspace package registered under the existing
      `apps/*` pnpm-workspace glob.
- [x] `tests/agent-resolves-ticket.spec.ts`: signs in as the seeded admin,
      opens a freshly-created ticket, changes its status to `RESOLVED`.
- [x] `tests/customer-submits-ticket.spec.ts`: signs in as a freshly
      -created portal Contact, submits a new ticket via the portal's
      inline form, sees it appear in the ticket list.
- [x] Both specs pass reliably in a full-suite run (not just in
      isolation).
- [x] `apps/e2e` typechecks and lints cleanly.
- [x] A new CI job added to `.github/workflows/ci.yml` running this suite
      (disclosed as unverified by an actual CI run from this environment).
- [x] Full monorepo verification cycle (existing unit/e2e suites,
      typecheck, lint, build) remains green — this story adds a new,
      isolated package and touches no existing application code.

## Verification plan

```
cd apps/e2e && npx tsc --noEmit
cd apps/e2e && npx eslint .
pnpm --filter @crm/web build
pnpm --filter @crm/portal build
cd apps/e2e && npx playwright test --reporter=list   # full suite, run directly (not via a destructive npm script)
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full API e2e sweep — run directly, never via the destructive test:e2e npm script
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
