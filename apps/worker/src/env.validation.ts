import { z } from "zod";

/**
 * `apps/worker` needed only Redis (BullMQ) through project-foundation
 * Story 02; sla-policy-foundation Story 15 added `DATABASE_URL` — the
 * minimum Prisma access needed for the `sla-timers` job to query
 * `SlaTicketTarget`/`Ticket`/`SlaPolicy` (see
 * apps/worker/src/prisma/prisma.service.ts). Remaining domain queues
 * (notifications, integration-sync, ai-processing, reports-refresh) are
 * still added by the feature stories that need them; see
 * docs/architecture/06-communication-and-realtime.md.
 */
/**
 * Deployment-configuration hardening — mirrors `apps/api`'s own
 * `optionalString` exactly (see that file's doc comment): deployment
 * platforms routinely materialize an unset variable as the empty string, and
 * `z.string().optional()` treats `""` as present, which defeats every
 * `?? fallback` downstream — most consequentially `PrismaService`'s
 * `APP_DATABASE_URL ?? DATABASE_URL`, which would construct a Prisma client
 * with `url: ""` instead of falling back.
 */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

/**
 * The same coercion for a field that has a *default* — mirrors `apps/api`'s
 * own `defaultedString`. `z.string().default(x)` only applies `x` when the
 * value is `undefined`, so a blank `ANTHROPIC_MODEL` would otherwise defeat
 * the default and send an empty model id to the provider.
 */
const defaultedString = (fallback: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().default(fallback),
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  /**
   * Story 115 — mirrors `apps/api`'s own `APP_DATABASE_URL` exactly (same
   * doc comment content, same "optional, falls back to DATABASE_URL"
   * semantics): `apps/worker`'s actual runtime Postgres connection
   * (`PrismaService`) uses this when set — the restricted `crm_app` role
   * — rather than the migration/owner role `DATABASE_URL` names.
   */
  APP_DATABASE_URL: optionalString,

  /**
   * Architecture-boundary refactor — mirrors `apps/api`'s own optional
   * `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` exactly (same default model,
   * same "unset is a valid, expected state" semantics). Added only so
   * `apps/worker` can construct the shared `@crm/ai` provider
   * (`src/ai/ai-provider.factory.ts`) from its own validated env — no
   * `ai-processing` queue/consumer exists yet (a separate future story).
   */
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: defaultedString("claude-sonnet-4-5-20250929"),

  /**
   * Story 113 — mirrors `apps/api`'s own optional `SENTRY_DSN` exactly
   * (same "unset is a valid, expected state" semantics — see that file's
   * own doc comment).
   */
  SENTRY_DSN: optionalString,

  /**
   * RM-15 — `EmailAdapter`'s SMTP transport config. All five deliberately
   * optional (same "unset is a valid, expected state" semantics as
   * `ANTHROPIC_API_KEY` above): with no `SMTP_HOST`, `ChannelsModule`
   * registers no `EMAIL` adapter at all — `ChannelAdapterRegistry.resolve
   * ("EMAIL")` then returns `undefined`, exactly RM-14's own existing
   * "not configured" behavior, not a new failure mode. Local dev points
   * these at the already-running Mailhog sandbox (`docker-compose.yml`:
   * `localhost:1025`); production rollout to a real relay is a separate,
   * later decision (`.squad/plans/core-completion-roadmap/
   * 02-product-decisions.md`, Decision Record 1) this story does not make.
   * `SMTP_PORT` defaults to `587` (the standard submission port) only
   * when `SMTP_HOST` — and therefore a real value — is actually present;
   * `z.coerce.number()` turns the env string into a real number.
   */
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive().default(587),
  ),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  /** The `From:` address `EmailAdapter` sends as. Required, alongside
   * `SMTP_HOST`, for the adapter to actually register — see
   * `channels.module.ts`'s own factory. */
  SMTP_FROM: optionalString,
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
