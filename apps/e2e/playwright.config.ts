import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const API_PORT = 3001;
const WEB_PORT = 3000;
const PORTAL_PORT = 3002;

/**
 * Story 114 — `apps/api`'s own `.env` (`DATABASE_URL`/`REDIS_URL`/
 * `JWT_*`/`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`/`PORT`) is loaded into
 * its OWN isolated object (`processEnv: {}`, never the ambient
 * `process.env`) and passed only to the `apps/api` `webServer` entry
 * below. Loading it into the ambient environment instead (e.g. via
 * `source .env` in the invoking shell) leaks `PORT=3001` into every
 * spawned child process, including `apps/web`'s/`apps/portal`'s own
 * `next dev` — Next.js also honors a `PORT` env var, so both would then
 * try to bind the *same* port `apps/api` already owns and fail with
 * `EADDRINUSE` (confirmed while first authoring this config). `SEED_ADMIN_EMAIL`/
 * `SEED_ADMIN_PASSWORD` are additionally copied onto the ambient
 * `process.env` — `support/api-client.ts` (used directly by the test
 * files, which run in this same top-level process, not a spawned child)
 * reads them from there, exactly like `apps/api/test/*.e2e-spec.ts` do.
 */
const apiEnv: Record<string, string> = {};
loadEnv({ path: path.resolve(__dirname, "../api/.env"), processEnv: apiEnv });
process.env.SEED_ADMIN_EMAIL ??= apiEnv.SEED_ADMIN_EMAIL;
process.env.SEED_ADMIN_PASSWORD ??= apiEnv.SEED_ADMIN_PASSWORD;
// A local dev `.env` typically only allows `apps/web`'s own origin
// (`CORS_ORIGINS="http://localhost:3000"`, since that's the only browser
// app a developer normally runs against it) — overridden here, for this
// suite's own `apps/api` instance only, so `apps/portal`'s origin is
// allowed too. Never written back to the real `.env` file.
apiEnv.CORS_ORIGINS = `http://localhost:${WEB_PORT},http://localhost:${PORTAL_PORT}`;

/**
 * Story 114 — docs/architecture/11-quality-and-operations.md: "E2E tests
 * use Playwright for a small set of critical flows: an agent resolves a
 * ticket and a customer submits one through the portal." Exactly those
 * two flows are covered here (`tests/agent-resolves-ticket.spec.ts`,
 * `tests/customer-submits-ticket.spec.ts`) — deliberately not a general
 * browser-testing framework for every screen; see this story's own plan
 * doc for the full list of what's out of scope.
 *
 * `webServer` starts all three backing services this suite needs.
 * `apps/api` uses its own `dev` script (`nest start --watch`) — a NestJS
 * backend has no dev/prod compile-timing distinction that matters here.
 * `apps/web`/`apps/portal` use `start` (a pre-built, production Next.js
 * server), NOT `dev`: `next dev`'s on-demand, per-route compilation
 * raced with this suite's own immediate `router.push()` right after
 * login, intermittently swallowing the navigation entirely (confirmed
 * while first authoring this suite — the login POST/cookie/response were
 * all genuinely correct; only the client-side navigation was lost, and
 * only in dev mode) — a `next dev`-specific class of flakiness that a
 * pre-built server doesn't have, and also a closer match to what a real
 * deployment actually runs. Requires `pnpm --filter @crm/web build` /
 * `pnpm --filter @crm/portal build` to have already run (see the CI job
 * this story adds, and this package's own README).
 *
 * `apps/worker` is deliberately NOT started: neither named flow depends
 * on an async side effect only the worker produces (SLA timers, AI
 * processing) to complete or be observable — see the plan doc's own
 * Non-goals.
 *
 * Each spec file's own `test.use({ baseURL })` picks between `apps/web`
 * and `apps/portal` (see each spec file) — no single global `baseURL`
 * here, since the two flows target two different apps.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @crm/api dev",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: "../..",
      env: apiEnv,
    },
    {
      command: "pnpm --filter @crm/web start",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
    },
    {
      command: "pnpm --filter @crm/portal start",
      url: `http://localhost:${PORTAL_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
    },
  ],
});
