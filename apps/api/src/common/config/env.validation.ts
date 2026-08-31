import { z } from "zod";

/**
 * Every environment variable `apps/api` reads, validated once at boot.
 * See docs/architecture/05-auth-and-security.md ("Secrets") and
 * docs/architecture/11-quality-and-operations.md ("Environments").
 *
 * A missing/malformed value fails startup immediately instead of the app
 * running with an undefined secret.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  /** Story 66 — Ticket Attachments is the first real consumer; these were
   * scaffolded optional since project foundation and stay required now
   * that `AttachmentsModule`'s `S3StorageService` actually reads them. */
  S3_ENDPOINT: z.string().min(1, "S3_ENDPOINT is required"),
  S3_ACCESS_KEY: z.string().min(1, "S3_ACCESS_KEY is required"),
  S3_SECRET_KEY: z.string().min(1, "S3_SECRET_KEY is required"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),

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
   * Story 72 — AI Services Foundation. Optional: no real caller requires a
   * working key yet (Stories 80-84 are the first consumers). When unset,
   * `AiModule` falls back to `NullAiProvider` rather than throwing at
   * boot — mirrors `CORS_ORIGINS`'s own "unset by default, feature simply
   * stays off" precedent, not `S3_*`'s "required once a real consumer
   * exists" one, since this foundation slice still has no real consumer.
   */
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Overridable so a future story never needs a code change to pick up a
   * new Claude model — the default is only ever exercised once a real
   * `ANTHROPIC_API_KEY` is configured. */
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5-20250929"),
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
