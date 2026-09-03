import { z } from "zod";
import { parseCorsOriginsDetailed } from "./cors-origins";

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

/**
 * Deployment-configuration hardening — deployment platforms (Kubernetes
 * `env:` entries, Compose `environment:` maps, hosted-platform variable
 * editors, GitHub Actions `env:`) routinely materialize an unset variable as
 * the *empty string* rather than omitting it. `z.string().optional()` treats
 * `""` as a present value, which turns every `?? fallback` in this app into
 * a no-op: `APP_DATABASE_URL=""` made `PrismaService` construct a client
 * with `url: ""` (Prisma then fails with an opaque "the URL must start with
 * the protocol postgresql://" instead of falling back to `DATABASE_URL` as
 * intended), and `CORS_ORIGINS=""` is indistinguishable from a deliberately
 * empty allow-list. Coercing blank to `undefined` here means "set to
 * nothing" and "not set" behave identically, which is what every consumer of
 * these values already assumes.
 */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

const baseEnvSchema = z.object({
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
   *
   * See `database-url.ts` for the boot-time diagnostic that reports which
   * of the two URLs the runtime connection actually came from, and warns
   * when the two name different databases.
   */
  APP_DATABASE_URL: optionalString,

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
   *
   * Deployment-configuration hardening — required, non-empty, and
   * individually well-formed when `NODE_ENV=production` (see the refinement
   * below). A production API with no allowed origins compiles, boots and
   * passes both health checks while every browser request from the deployed
   * web app and portal fails at the preflight, which reads to a user as
   * "login is broken" rather than as a configuration error.
   */
  CORS_ORIGINS: optionalString,

  /**
   * Deployment-configuration hardening — `SameSite` for the httpOnly
   * refresh-token cookie `identity.controller.ts` and `portal.controller.ts`
   * set. Defaults to `strict`, which is exactly what those controllers
   * hard-coded before this variable existed, so no already-working
   * deployment changes behavior.
   *
   * It has to be configurable because `SameSite` is decided by *deployment
   * topology*, not by application code. A browser only sends a
   * `SameSite=strict` cookie on same-site requests, and "same site" means
   * the same registrable domain — so:
   *
   *   - `crm.example.com` (web) calling `api.example.com` (API) is same-site.
   *     `strict` works; keep the default.
   *   - a deployment where the browser origin and the API origin sit on
   *     different registrable domains is *cross-site*. The refresh-token
   *     cookie is then never sent, so `POST /auth/refresh` and
   *     `POST /auth/switch-branch` 401 — login appears to succeed and the
   *     session then silently dies at the first access-token expiry. Such a
   *     deployment must set `none`.
   *
   * `none` is only accepted alongside `Secure` cookies, which this app ties
   * to `NODE_ENV=production` — browsers reject `SameSite=None` without
   * `Secure`, so allowing it in development would produce a cookie the
   * browser drops outright.
   */
  AUTH_COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("strict"),

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
  SENTRY_DSN: optionalString,
});

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  /**
   * Deployment-configuration hardening — the two JWT secrets must be
   * independent. Both are HMAC keys for the same algorithm, so reusing one
   * value for both makes a refresh token a structurally valid access token
   * and vice versa: `JwtStrategy` would accept a refresh token as a bearer
   * credential, defeating both the short access-token TTL and the
   * server-side refresh-token revocation the identity module relies on.
   * Cheap to get wrong (one copy-paste in a secrets manager) and invisible
   * at runtime, so it is rejected at boot.
   */
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["JWT_REFRESH_SECRET"],
      message:
        "JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET — reusing one " +
        "secret for both lets a refresh token be presented as an access token. " +
        "Generate two independent values (e.g. run `openssl rand -base64 48` twice).",
    });
  }

  if (env.AUTH_COOKIE_SAMESITE === "none" && env.NODE_ENV !== "production") {
    ctx.addIssue({
      code: "custom",
      path: ["AUTH_COOKIE_SAMESITE"],
      message:
        'AUTH_COOKIE_SAMESITE="none" requires NODE_ENV=production, because ' +
        "browsers reject a SameSite=None cookie that is not also Secure and " +
        "this app only marks the refresh cookie Secure in production.",
    });
  }

  const { origins, invalid } = parseCorsOriginsDetailed(env.CORS_ORIGINS);

  for (const entry of invalid) {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGINS"],
      message: `"${entry.value}" is not a usable browser origin — ${entry.reason}`,
    });
  }

  if (env.NODE_ENV === "production" && origins.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGINS"],
      message:
        "CORS_ORIGINS is required in production and must list every deployed " +
        "browser origin that calls this API — the agent workspace (apps/web) " +
        "and, where deployed, the customer portal (apps/portal), e.g. " +
        '"https://crm.example.com,https://portal.example.com". With none set, ' +
        "this API rejects every cross-origin request, which presents in the " +
        "browser as an unreachable API rather than as a configuration error.",
    });
  }
});

export type EnvConfig = z.infer<typeof baseEnvSchema>;

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
