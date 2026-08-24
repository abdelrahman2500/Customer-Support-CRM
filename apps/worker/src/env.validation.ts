import { z } from "zod";

/**
 * `apps/worker` only needs Redis (BullMQ) in this foundation story — it has
 * no domain queues yet (sla-timers, notifications, integration-sync,
 * ai-processing, reports-refresh are added by the feature stories that need
 * them; see docs/architecture/06-communication-and-realtime.md).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
