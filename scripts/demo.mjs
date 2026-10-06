#!/usr/bin/env node
/**
 * Demo hardening — the product demo runs on its own database, never on the
 * shared dev database that automated tests write to.
 *
 *   DEMO_USER_PASSWORD=… pnpm demo:reset   # rebuild the demo database from scratch
 *   pnpm demo:api                          # the API against the demo database
 *   pnpm demo:worker                       # the worker against the demo database
 *
 * The demo database is derived from `apps/api/.env`: same Postgres server and
 * credentials, database name `crm_demo`; Redis uses database 1 instead of 0,
 * so queued jobs and presence never mix with dev. Mirrors
 * `apps/api/scripts/with-test-db.mjs` (which does the same for `crm_test`),
 * including its refusal to run if the effective URL is the dev database.
 *
 * `reset` is safe to repeat: it drops and recreates only `crm_demo` with
 * `prisma migrate reset` (every migration re-applied, so the schema is always
 * current), flushes only Redis database 1, then runs the base seed and the
 * demo seed. It never touches the dev or test databases.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_ROOT = path.join(ROOT, "apps", "api");
const DEV_ENV_PATH = path.join(API_ROOT, ".env");
const DEMO_DB_NAME = "crm_demo";
const DEMO_REDIS_DB = "1";
const PROTECTED_DB_NAMES = new Set(["crm", "crm_test"]);

function fail(message) {
  console.error(`[demo] ${message}`);
  process.exit(1);
}

if (!existsSync(DEV_ENV_PATH)) {
  fail("apps/api/.env not found — set up the local environment first (see README).");
}
const devEnv = parseEnv(readFileSync(DEV_ENV_PATH, "utf8"));

function withDatabase(urlString, name) {
  const url = new URL(urlString);
  url.pathname = `/${name}`;
  return url.toString();
}
function databaseOf(urlString) {
  return new URL(urlString).pathname.replace(/^\//, "");
}

const env = { ...process.env };
for (const key of ["DATABASE_URL", "APP_DATABASE_URL"]) {
  if (devEnv[key]) env[key] = withDatabase(devEnv[key], DEMO_DB_NAME);
}
if (devEnv.REDIS_URL) {
  const redis = new URL(devEnv.REDIS_URL);
  redis.pathname = `/${DEMO_REDIS_DB}`;
  env.REDIS_URL = redis.toString();
}
for (const key of ["DATABASE_URL", "APP_DATABASE_URL"]) {
  if (env[key] && PROTECTED_DB_NAMES.has(databaseOf(env[key]))) {
    fail(`Refusing to run: ${key} points at the "${databaseOf(env[key])}" database.`);
  }
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    fail(`"${command} ${args.join(" ")}" failed (exit ${result.status ?? "signal"}).`);
  }
}

const command = process.argv[2];
switch (command) {
  case "reset": {
    if (!env.DEMO_USER_PASSWORD || env.DEMO_USER_PASSWORD.length < 8) {
      fail(
        "Set DEMO_USER_PASSWORD (at least 8 characters) — the password every demo account uses.",
      );
    }
    console.error(
      `[demo] Resetting the "${DEMO_DB_NAME}" database and Redis database ${DEMO_REDIS_DB}…`,
    );
    run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], API_ROOT);
    run(
      "node",
      [
        "-e",
        "const Redis=require('ioredis');const r=new Redis(process.env.REDIS_URL);r.flushdb().then(()=>r.quit()).catch((e)=>{console.error(e);process.exit(1)})",
      ],
      API_ROOT,
    );
    run("npx", ["tsx", "prisma/seed.ts"], API_ROOT);
    run("npx", ["tsx", "prisma/seed-demo.ts"], API_ROOT);
    console.error(
      "[demo] Done. Start the stack with `pnpm demo:api`, `pnpm demo:worker` and the two apps.",
    );
    break;
  }
  case "api":
    run("pnpm", ["--filter", "@crm/api", "start"]);
    break;
  case "worker":
    run("pnpm", ["--filter", "@crm/worker", "start"]);
    break;
  default:
    fail("Usage: node scripts/demo.mjs <reset|api|worker>");
}
