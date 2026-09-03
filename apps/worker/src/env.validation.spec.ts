import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

/**
 * `apps/worker`'s environment contract. Mirrors the parts of
 * `apps/api/src/common/config/env.validation.spec.ts` that apply here —
 * specifically the blank-is-unset coercion, which is what stops a
 * deployment platform's empty-string variable from defeating a fallback.
 */
const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://crm:crm_dev_password@localhost:5432/crm?schema=public",
  REDIS_URL: "redis://localhost:6379",
} as const;

describe("validateEnv (worker)", () => {
  it("accepts the minimum required environment", () => {
    const env = validateEnv({ ...baseEnv });
    expect(env.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
    expect(env.REDIS_URL).toBe(baseEnv.REDIS_URL);
    expect(env.NODE_ENV).toBe("test");
  });

  // An *absent* value reports zod's own "expected string, received
  // undefined"; the schema's custom "is required" message only fires for a
  // present-but-empty string. Both name the offending variable, which is the
  // part a deployment operator needs, so that is what is asserted here.
  it("names DATABASE_URL when it is absent", () => {
    expect(() => validateEnv({ REDIS_URL: baseEnv.REDIS_URL })).toThrow(/DATABASE_URL/);
  });

  it("names REDIS_URL when it is absent", () => {
    expect(() => validateEnv({ DATABASE_URL: baseEnv.DATABASE_URL })).toThrow(/REDIS_URL/);
  });

  it("reports the custom message for a present-but-empty required value", () => {
    expect(() => validateEnv({ ...baseEnv, DATABASE_URL: "" })).toThrow(/DATABASE_URL is required/);
  });

  describe("blank-vs-unset optional values", () => {
    /**
     * The regression that matters: `PrismaService` falls back to
     * DATABASE_URL only when APP_DATABASE_URL is absent. A platform that
     * materializes it as "" would otherwise hand Prisma an empty datasource
     * URL and crash-loop the worker.
     */
    it("treats a blank APP_DATABASE_URL as unset", () => {
      expect(validateEnv({ ...baseEnv, APP_DATABASE_URL: "" }).APP_DATABASE_URL).toBeUndefined();
      expect(validateEnv({ ...baseEnv, APP_DATABASE_URL: "  " }).APP_DATABASE_URL).toBeUndefined();
    });

    it("keeps a real APP_DATABASE_URL", () => {
      const url = "postgresql://crm_app:pw@localhost:5432/crm?schema=public";
      expect(validateEnv({ ...baseEnv, APP_DATABASE_URL: url }).APP_DATABASE_URL).toBe(url);
    });

    it("treats a blank ANTHROPIC_API_KEY and SENTRY_DSN as unset", () => {
      const env = validateEnv({ ...baseEnv, ANTHROPIC_API_KEY: "", SENTRY_DSN: "" });
      // An absent key is what selects the no-op "disabled" AI provider, so
      // "" must not read as a configured key.
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      expect(env.SENTRY_DSN).toBeUndefined();
    });
  });

  describe("ANTHROPIC_MODEL", () => {
    const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

    it("applies the default when unset", () => {
      expect(validateEnv({ ...baseEnv }).ANTHROPIC_MODEL).toBe(DEFAULT_MODEL);
    });

    /**
     * A defaulted field, so `undefined` alone triggers the default — a blank
     * value would otherwise pass straight through and send an empty model id
     * to the provider.
     */
    it("falls back to the default when blank", () => {
      expect(validateEnv({ ...baseEnv, ANTHROPIC_MODEL: "" }).ANTHROPIC_MODEL).toBe(DEFAULT_MODEL);
      expect(validateEnv({ ...baseEnv, ANTHROPIC_MODEL: "  " }).ANTHROPIC_MODEL).toBe(
        DEFAULT_MODEL,
      );
    });

    it("keeps a real override", () => {
      expect(validateEnv({ ...baseEnv, ANTHROPIC_MODEL: "claude-opus-4-1" }).ANTHROPIC_MODEL).toBe(
        "claude-opus-4-1",
      );
    });
  });
});
