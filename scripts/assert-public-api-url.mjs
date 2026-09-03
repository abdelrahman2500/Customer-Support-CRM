#!/usr/bin/env node
/**
 * Deployment guard — proves that a built Next.js app will actually call the
 * deployed API, and not the local-development fallback.
 *
 * `apps/web/src/lib/api.ts` and `apps/portal/src/lib/api.ts` both read:
 *
 *     process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"
 *
 * `NEXT_PUBLIC_*` variables are *compile-time* substitutions: `next build`
 * replaces that expression with a string literal and burns it into the
 * browser bundle. Nothing at container-runtime can change it afterwards.
 * So if `NEXT_PUBLIC_API_URL` is absent (or, worse, present but pointing at
 * localhost) at image-build time, the resulting image is permanently wrong:
 * every deployed browser tries to reach `http://localhost:3001/api/v1`,
 * which resolves to the *user's own machine*, and the failure surfaces as a
 * network error on the login form with nothing in the API's logs.
 *
 * That failure mode is invisible to `pnpm build`, `pnpm typecheck`, `pnpm
 * lint` and the unit tests — which is exactly why it needs its own check.
 * This script is run in two places:
 *
 *   1. inside `apps/web/Dockerfile` and `apps/portal/Dockerfile`, straight
 *      after `next build`, so a misconfigured image fails to build instead
 *      of shipping;
 *   2. from CI (`.github/workflows/ci.yml`), against the images it builds.
 *
 * Usage:
 *   node scripts/assert-public-api-url.mjs <built-app-dir> [expected-url]
 *
 * e.g. `node scripts/assert-public-api-url.mjs apps/web`
 *
 * With `expected-url` given, the built output must additionally contain that
 * exact string — proof the intended value was the one compiled in, not just
 * that the fallback happens to be absent.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/** The literal fallback in both apps' own `getApiBaseUrl()`. */
const LOCALHOST_API_FALLBACK = "http://localhost:3001/api/v1";

const appDir = process.argv[2];
const expectedUrl = process.argv[3];

if (!appDir) {
  console.error("usage: node scripts/assert-public-api-url.mjs <built-app-dir> [expected-url]");
  process.exit(2);
}

const buildDir = resolve(appDir, ".next");
if (!existsSync(buildDir)) {
  console.error(`[assert-public-api-url] no build output at ${buildDir} — run the build first.`);
  process.exit(2);
}

/**
 * Only the client-side bundle matters: `.next/static` is what a browser
 * downloads and executes. `.next/server` is inspected too, since the
 * Next.js server renders pages that fetch from the same base URL, but
 * `.next/cache` is skipped — it holds pre-compile intermediates that can
 * legitimately still carry a stale value from a previous build.
 */
function* walk(dir) {
  if (!existsSync(dir)) {
    return;
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "cache") {
        continue;
      }
      yield* walk(full);
      continue;
    }
    if (/\.(js|mjs|cjs|json|txt|html)$/.test(entry)) {
      yield full;
    }
  }
}

const offenders = [];
const matchesExpected = [];

for (const file of walk(buildDir)) {
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (contents.includes(LOCALHOST_API_FALLBACK)) {
    offenders.push(file);
  }
  if (expectedUrl && contents.includes(expectedUrl)) {
    matchesExpected.push(file);
  }
}

let failed = false;

if (offenders.length > 0) {
  failed = true;
  console.error(
    `\n[assert-public-api-url] FAIL — the local-development API fallback ` +
      `"${LOCALHOST_API_FALLBACK}" is compiled into ${offenders.length} file(s) of ` +
      `${appDir}'s build output:\n` +
      offenders
        .slice(0, 10)
        .map((file) => `  - ${file}`)
        .join("\n") +
      (offenders.length > 10 ? `\n  ... and ${offenders.length - 10} more` : "") +
      `\n\nA deployed browser would try to reach the developer's own machine.\n` +
      `Set NEXT_PUBLIC_API_URL to the deployed API's base URL (including the\n` +
      `/api/v1 suffix) *before* running the build. For a container image that\n` +
      `means a --build-arg, not a runtime -e: NEXT_PUBLIC_* is substituted at\n` +
      `compile time and cannot be changed afterwards. See docs/deployment.md.\n`,
  );
}

if (expectedUrl && matchesExpected.length === 0) {
  failed = true;
  console.error(
    `\n[assert-public-api-url] FAIL — expected "${expectedUrl}" to be compiled ` +
      `into ${appDir}'s build output, but no file contains it. NEXT_PUBLIC_API_URL ` +
      `was probably not visible to the build process.\n`,
  );
}

if (failed) {
  process.exit(1);
}

console.log(
  `[assert-public-api-url] OK — ${appDir}: no localhost API fallback in the build output` +
    (expectedUrl ? `; "${expectedUrl}" is compiled in.` : "."),
);
