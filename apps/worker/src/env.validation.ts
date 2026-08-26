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
