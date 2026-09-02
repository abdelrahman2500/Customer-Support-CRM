import { z } from "zod";

/**
 * Every environment variable `apps/api` reads, validated once at boot.
 * See docs/architecture/05-auth-and-security.md ("Secrets") and
 * docs/architecture/11-quality-and-operations.md ("Environments").
 *
 * A missing/malformed value fails startup immediately instead of the app
 * running with an undefined secret.
 *
 * Story 76 — `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` (added by Story 72)
 * were removed from here: `apps/api` no longer constructs an `AiProvider`
 * at all (see `AiModule`'s own doc comment) — only `apps/worker`'s own
 * `env.validation.ts` reads them now.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  /**
   * Story 115 — `DATABASE_URL` keeps meaning "the migration/owner role"
   * (used by `prisma migrate deploy`/`prisma db seed`/`prisma generate`,
   * unaffected by this variable — the Prisma CLI reads its own
   * `env("DATABASE_URL")` datasource declaration directly). This app's
   * actual runtime Postgres connection (`PrismaService`) uses
   * `APP_DATABASE_URL` when set — the restricted `crm_app` role a
   * `add_runtime_db_role_grants`-family migration provisions, which
   * cannot alter schema and is denied UPDATE/DELETE on
   * `admin.audit_logs` (docs/architecture/05-auth-and-security.md).
   * Optional, falling back to `DATABASE_URL`: a required addition here
   * would fail startup for every already-configured environment that
   * hasn't set it yet — see this variable's own story plan for why that
   * would violate this project's backward-compatibility rules.
   */
  APP_DATABASE_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  /** Story 66 — Ticket Attachments is the first real consumer. Keep the
   * local MinIO defaults here so test/CI bootstraps do not fail when the
   * per-app `.env` file is not present yet; production and local overrides
   * still win because `ConfigModule.forRoot()` reads the actual environment
   * values before validation. */
  S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT is required").default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().min(1, "S3_ACCESS_KEY is required").default("minioadmin"),
  S3_SECRET_KEY: z.string().min(1, "S3_SECRET_KEY is required").default("minioadmin"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required").default("crm-attachments"),

  /**
   * Story 23 — comma-separated list of allowed browser origins for both the
   * REST API (`app.enableCors()`, `main.ts`) and the Socket.IO gateway
   * (`RedisIoAdapter`). Unset by default: no origin is allowed unless a
   * deployment explicitly opts in (see `parseCorsOrigins`,
   * `common/config/cors-origins.ts`). Local development value:
   * `http://localhost:3000`. No production origin is hard-coded here.
   */
  CORS_ORIGINS: z.string().optional(),

  /**
   * Story 113 — docs/architecture/11-quality-and-operations.md: "Sentry
   * or self-hosted GlitchTip captures unhandled frontend and backend
   * exceptions." Optional, mirroring `CORS_ORIGINS`'s own "unset is a
   * valid, expected state" precedent: unhandled exceptions are still
   * caught and logged either way (see `SentryExceptionFilter`); a set
   * `SENTRY_DSN` additionally reports them. GlitchTip is Sentry-protocol-
   * compatible, so the exact same DSN-based configuration works for
   * either provider — no provider-specific code branches here.
   */
  SENTRY_DSN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
