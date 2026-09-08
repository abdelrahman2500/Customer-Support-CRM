#!/usr/bin/env node
/**
 * Runs the given command (`prisma migrate reset --force`, `vitest run
 * e2e-spec`, ...) against an isolated e2e **test** database — never the
 * shared local dev database `apps/api/.env` points `DATABASE_URL` at.
 *
 * Root cause this exists to close: before this script, `test:e2e:prepare`
 * (`prisma migrate reset --force`) and the e2e suite itself both read
 * `DATABASE_URL` from the exact same `apps/api/.env` the running dev API
 * server uses (Prisma CLI, `@nestjs/config`'s `ConfigModule.forRoot()`, and
 * every e2e spec that reads `process.env.DATABASE_URL` directly all resolve
 * the same file via `dotenv`'s default cwd-relative lookup — there was no
 * separate test config anywhere). Running `pnpm test:e2e` locally therefore
 * wiped and re-seeded the developer's own dev database, and left e2e
 * fixture data (e.g. `branding.e2e-spec.ts`'s fake
 * `https://example.com/logo-<uuid>.png`) sitting in it afterward.
 *
 * How this fixes it:
 *   - If `DATABASE_URL` (or `APP_DATABASE_URL`) is not already set in the
 *     environment, it is derived from `apps/api/.env`'s own value with only
 *     the database name swapped to `crm_test` — same server/credentials,
 *     an entirely separate database, so `prisma migrate reset`'s DROP/
 *     recreate never touches the dev database's tables.
 *   - `spawnSync` (not a `dotenv`-loading library) sets these directly on
 *     `process.env` *before* the child process starts, so every downstream
 *     reader — Prisma CLI's own env-file lookup, `ConfigModule.forRoot()`'s
 *     `dotenv.config()`, and any e2e spec that reads `process.env.*`
 *     directly (e.g. `audit-log-db-grants.e2e-spec.ts`) — all resolve the
 *     *same* already-set test value, since `dotenv`'s (and Node's own
 *     `process.loadEnvFile`'s) documented default never overrides a
 *     variable that's already present in `process.env`. Verified directly
 *     against `process.loadEnvFile` while authoring this script — see this
 *     story's completion report.
 *   - A hard safety check (below) then refuses to run at all if, despite
 *     the above, the *effective* `DATABASE_URL`/`APP_DATABASE_URL` this
 *     process is about to use still resolves to the same host+database as
 *     `apps/api/.env`'s dev config — e.g. a developer had exported
 *     `DATABASE_URL` in their shell pointing at the dev database. This is
 *     what makes "never touches the dev DB" an enforced invariant rather
 *     than just an expected default.
 *   - In CI (`.github/workflows/ci.yml`), `apps/api/.env` does not exist
 *     (it's git-ignored — never checked out) and `DATABASE_URL` is instead
 *     supplied as a real, already-set, job-level env var pointing at that
 *     job's own ephemeral Postgres service container. With no dev `.env` to
 *     compare against, every check above is a deliberate, harmless no-op —
 *     CI's `test:e2e` step already runs against a single-purpose database
 *     with nothing else to protect.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEV_ENV_PATH = path.join(API_ROOT, ".env");
const TEST_DB_NAME = "crm_test";
const DB_URL_KEYS = /** @type {const} */ (["DATABASE_URL", "APP_DATABASE_URL"]);

/** Reads `apps/api/.env` as plain text and returns its keys, without ever
 * writing anything to `process.env` — a pure peek, so it can be compared
 * against `process.env`'s own state regardless of whether that state came
 * from this same file or from the caller's shell. */
function readDevEnv() {
  if (!existsSync(DEV_ENV_PATH)) {
    return {};
  }
  return parseEnv(readFileSync(DEV_ENV_PATH, "utf8"));
}

/** `{host}:{port}{/database}` — the identity that actually matters for
 * "is this the same database", ignoring credentials (mirrors
 * `src/common/config/database-url.ts`'s own `parseDatabaseTarget`, which
 * this script deliberately does not import — it must stay a plain,
 * dependency-free Node script runnable before `pnpm install`/`prisma
 * generate` have necessarily produced a compiled/typed `src/`). */
function targetOf(urlString) {
  const url = new URL(urlString);
  return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
}

function withTestDbName(urlString) {
  const url = new URL(urlString);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

const devEnv = readDevEnv();
const devEnvExists = existsSync(DEV_ENV_PATH);

for (const key of DB_URL_KEYS) {
  if (process.env[key]) {
    continue; // Already set (CI, or an explicit override) — never touched.
  }
  const devValue = devEnv[key];
  if (!devValue) {
    continue; // Neither ambient nor in apps/api/.env — nothing to derive.
  }
  process.env[key] = withTestDbName(devValue);
  console.error(`[with-test-db] ${key} -> isolated test database (${targetOf(process.env[key])})`);
}

// Hard safety net: whatever ended up in process.env (freshly derived above,
// or already ambient from the caller's shell) must NOT resolve to the same
// database as apps/api/.env's own dev config. This is the one check that
// makes "can never mutate the dev DB" true regardless of *how* the
// effective URL was set.
if (devEnvExists) {
  for (const key of DB_URL_KEYS) {
    const devValue = devEnv[key];
    const effective = process.env[key];
    if (!devValue || !effective) {
      continue;
    }
    if (targetOf(effective) === targetOf(devValue)) {
      console.error(
        `[with-test-db] Refusing to run: ${key} (${targetOf(effective)}) is the same ` +
          `database as apps/api/.env's dev ${key}. e2e tests must run against an ` +
          `isolated database — point ${key} at a different database, or unset it so ` +
          `this script can derive "${TEST_DB_NAME}" automatically.`,
      );
      process.exit(1);
    }
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("[with-test-db] Usage: node scripts/with-test-db.mjs <command> [...args]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  cwd: API_ROOT,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
if (result.error) {
  console.error(`[with-test-db] Failed to run "${command}":`, result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
