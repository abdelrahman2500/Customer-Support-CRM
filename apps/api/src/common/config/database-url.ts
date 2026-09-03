/**
 * Deployment-configuration diagnostics for this app's two Postgres URLs.
 *
 * `apps/api` deliberately reads two different connection strings (see
 * `env.validation.ts` and `prisma/../prisma.service.ts`):
 *
 *   - `DATABASE_URL`     — the migration/owner role. The Prisma CLI reads
 *                          this directly from `schema.prisma`'s
 *                          `env("DATABASE_URL")` datasource, so it is what
 *                          `prisma migrate deploy` / `prisma db seed` /
 *                          `prisma generate` act on.
 *   - `APP_DATABASE_URL` — the restricted `crm_app` runtime role the running
 *                          app actually connects as, when set.
 *
 * That split is intentional, but it is also the single easiest production
 * misconfiguration to make: point them at two *different databases* and the
 * deployment looks healthy — migrations succeed, the API boots, `/health`
 * and `/health/ready` both return 200 — while every query runs against a
 * database that was never migrated or seeded. Login then fails with an
 * opaque error even though nothing is wrong with the auth code.
 *
 * These helpers exist so `main.ts` can state, in one boot log line, exactly
 * which of the two URLs the runtime connection came from and which database
 * it resolved to, and warn when the two disagree. Deliberately a *warning*,
 * not a startup failure: a managed-Postgres deployment legitimately routes
 * the runtime role through a connection pooler on a different host/port than
 * the direct connection migrations use (pgBouncer, Supabase's pooler, Neon's
 * pooled endpoint), so differing hosts are normal. A differing *database
 * name* is the signal that actually indicates a mistake.
 *
 * Pure and dependency-free so it is unit-testable on its own — the same
 * "extract the pure piece" convention as `cors-origins.ts`.
 */

export interface DatabaseTarget {
  host: string;
  port: string;
  /** Database name — the URL's path segment, without the leading slash. */
  database: string;
}

/**
 * Extracts the host/port/database a Postgres connection string points at,
 * or `null` when the value is not a parseable URL. Never returns or logs
 * the credentials embedded in the URL.
 */
export function parseDatabaseTarget(url: string | undefined): DatabaseTarget | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    database: parsed.pathname.replace(/^\//, ""),
  };
}

/**
 * Renders a connection string safe to write to a log or an error message:
 * the password is replaced with `***`, everything else is preserved so the
 * host/port/database/search-path stay diagnosable. Falls back to a fixed
 * placeholder rather than echoing an unparseable value, which could itself
 * be a pasted secret.
 */
export function redactDatabaseUrl(url: string | undefined): string {
  if (!url) {
    return "(unset)";
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "(unparseable connection string)";
  }
  if (parsed.password) {
    parsed.password = "***";
  }
  return parsed.toString();
}

export interface ResolvedRuntimeDatabase {
  /** The connection string `PrismaService` should actually open. */
  url: string;
  /** Which environment variable it came from. */
  source: "APP_DATABASE_URL" | "DATABASE_URL";
}

/**
 * Decides which of the two URLs the running app connects as — the single
 * source of truth for that choice, used by `PrismaService` and by the boot
 * diagnostic below so the two can never disagree.
 *
 * A **blank** `APP_DATABASE_URL` counts as absent. That is not defensive
 * padding: `env.validation.ts` already normalizes `""` to `undefined`, but
 * `@nestjs/config`'s `ConfigService.get()` falls through to raw `process.env`
 * whenever the validated value is `undefined` — so a platform that
 * materializes the variable as the empty string (Compose's
 * `${APP_DATABASE_URL:-}`, a Kubernetes `env:` entry with no value, an
 * emptied field in a PaaS variable editor) still hands `""` straight back to
 * the caller. Before this check, that produced
 * `PrismaClientInitializationError: Error validating datasource 'db': You
 * must provide a nonempty URL` and a crash-looping container, because `??`
 * only replaces `null`/`undefined` and `""` sailed through as if it were a
 * real connection string. Reproduced end to end with
 * `docker-compose.prod.yml`.
 */
export function resolveRuntimeDatabaseUrl(
  databaseUrl: string,
  appDatabaseUrl: string | undefined,
): ResolvedRuntimeDatabase {
  const app = appDatabaseUrl?.trim();
  return app
    ? { url: app, source: "APP_DATABASE_URL" }
    : { url: databaseUrl, source: "DATABASE_URL" };
}

export interface RuntimeDatabaseDescription {
  /** Which environment variable the runtime connection was taken from. */
  source: "APP_DATABASE_URL" | "DATABASE_URL";
  /** The runtime connection string, password-redacted, safe to log. */
  redacted: string;
  /**
   * Set when the runtime connection and the migration connection resolve to
   * different database names — i.e. the runtime API is about to query a
   * database that `prisma migrate deploy` did not touch. `null` when they
   * agree, when only one is configured, or when either is unparseable.
   */
  warning: string | null;
}

/**
 * Describes the connection `PrismaService` will actually open, given the two
 * validated environment values, for a single boot log line.
 */
export function describeRuntimeDatabase(
  databaseUrl: string,
  appDatabaseUrl: string | undefined,
): RuntimeDatabaseDescription {
  const { url: runtimeUrl, source } = resolveRuntimeDatabaseUrl(databaseUrl, appDatabaseUrl);

  let warning: string | null = null;
  if (source === "APP_DATABASE_URL") {
    const migrationTarget = parseDatabaseTarget(databaseUrl);
    const runtimeTarget = parseDatabaseTarget(runtimeUrl);
    if (migrationTarget && runtimeTarget && migrationTarget.database !== runtimeTarget.database) {
      warning =
        `APP_DATABASE_URL targets database "${runtimeTarget.database}" but ` +
        `DATABASE_URL (used by prisma migrate deploy / prisma db seed) targets ` +
        `"${migrationTarget.database}". The running API will query a database ` +
        `that migrations and seed did not apply to. Point both at the same ` +
        `database, or unset APP_DATABASE_URL.`;
    }
  }

  return { source, redacted: redactDatabaseUrl(runtimeUrl), warning };
}
