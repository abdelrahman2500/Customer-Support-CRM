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
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  /**
   * Architecture-boundary refactor — mirrors `apps/api`'s own optional
   * `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` exactly (same default model,
   * same "unset is a valid, expected state" semantics). Added only so
   * `apps/worker` can construct the shared `@crm/ai` provider
   * (`src/ai/ai-provider.factory.ts`) from its own validated env — no
   * `ai-processing` queue/consumer exists yet (a separate future story).
   */
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5-20250929"),

  /**
   * Story 113 — mirrors `apps/api`'s own optional `SENTRY_DSN` exactly
   * (same "unset is a valid, expected state" semantics — see that file's
   * own doc comment).
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
