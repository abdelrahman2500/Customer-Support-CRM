import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

/**
 * The minimum a valid environment needs. Deliberately uses two *different*
 * JWT secrets — see the "rejects reusing one secret for both JWTs" case
 * below for why identical values are now a startup failure.
 */
const baseEnv = {
  NODE_ENV: "test",
  PORT: "3001",
  DATABASE_URL: "postgresql://crm:crm_dev_password@localhost:5432/crm?schema=public",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "access-12345678901234567890123456789012",
  JWT_REFRESH_SECRET: "refresh-1234567890123456789012345678901",
} as const;

describe("validateEnv", () => {
  it("applies local MinIO defaults when S3 settings are absent", () => {
    const env = validateEnv({ ...baseEnv });

    expect(env).toMatchObject({
      S3_ENDPOINT: "http://localhost:9000",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin",
      S3_BUCKET: "crm-attachments",
    });
  });

  it("defaults the refresh cookie to SameSite=strict, the previously hard-coded value", () => {
    expect(validateEnv({ ...baseEnv }).AUTH_COOKIE_SAMESITE).toBe("strict");
  });

  describe("blank-vs-unset optional values", () => {
    // Deployment platforms routinely materialize an unset variable as "".
    it("treats an empty APP_DATABASE_URL as unset so PrismaService falls back to DATABASE_URL", () => {
      expect(validateEnv({ ...baseEnv, APP_DATABASE_URL: "" }).APP_DATABASE_URL).toBeUndefined();
      expect(validateEnv({ ...baseEnv, APP_DATABASE_URL: "   " }).APP_DATABASE_URL).toBeUndefined();
    });

    it("keeps a real APP_DATABASE_URL", () => {
      const url = "postgresql://crm_app:pw@localhost:5432/crm?schema=public";
      expect(validateEnv({ ...baseEnv, APP_DATABASE_URL: url }).APP_DATABASE_URL).toBe(url);
    });

    it("treats an empty CORS_ORIGINS and SENTRY_DSN as unset", () => {
      const env = validateEnv({ ...baseEnv, CORS_ORIGINS: "", SENTRY_DSN: "" });
      expect(env.CORS_ORIGINS).toBeUndefined();
      expect(env.SENTRY_DSN).toBeUndefined();
    });
  });

  describe("JWT secret independence", () => {
    it("rejects reusing one secret for both JWTs", () => {
      const shared = "12345678901234567890123456789012";
      expect(() =>
        validateEnv({ ...baseEnv, JWT_ACCESS_SECRET: shared, JWT_REFRESH_SECRET: shared }),
      ).toThrow(/JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET/);
    });

    it("still rejects a secret shorter than 32 characters", () => {
      expect(() => validateEnv({ ...baseEnv, JWT_ACCESS_SECRET: "too-short" })).toThrow(
        /JWT_ACCESS_SECRET must be at least 32 characters/,
      );
      expect(() => validateEnv({ ...baseEnv, JWT_REFRESH_SECRET: "too-short" })).toThrow(
        /JWT_REFRESH_SECRET must be at least 32 characters/,
      );
    });
  });

  describe("CORS_ORIGINS", () => {
    it("accepts an unset value outside production (fails closed, unchanged)", () => {
      expect(validateEnv({ ...baseEnv }).CORS_ORIGINS).toBeUndefined();
    });

    it("requires a non-empty value in production", () => {
      expect(() => validateEnv({ ...baseEnv, NODE_ENV: "production" })).toThrow(
        /CORS_ORIGINS is required in production/,
      );
      expect(() => validateEnv({ ...baseEnv, NODE_ENV: "production", CORS_ORIGINS: "" })).toThrow(
        /CORS_ORIGINS is required in production/,
      );
    });

    it("accepts a production value listing the web and portal origins", () => {
      const env = validateEnv({
        ...baseEnv,
        NODE_ENV: "production",
        CORS_ORIGINS: "https://crm.example.com,https://portal.example.com",
      });
      expect(env.CORS_ORIGINS).toBe("https://crm.example.com,https://portal.example.com");
    });

    it("rejects an entry that can never match a browser Origin header", () => {
      expect(() =>
        validateEnv({
          ...baseEnv,
          NODE_ENV: "production",
          CORS_ORIGINS: "https://crm.example.com/login",
        }),
      ).toThrow(/is not a usable browser origin/);
    });

    it("rejects an entry with no scheme even outside production", () => {
      expect(() => validateEnv({ ...baseEnv, CORS_ORIGINS: "crm.example.com" })).toThrow(
        /is not a usable browser origin/,
      );
    });
  });

  describe("AUTH_COOKIE_SAMESITE", () => {
    it("accepts strict and lax in any environment", () => {
      expect(validateEnv({ ...baseEnv, AUTH_COOKIE_SAMESITE: "lax" }).AUTH_COOKIE_SAMESITE).toBe(
        "lax",
      );
    });

    it("accepts none in production, where the cookie is also Secure", () => {
      const env = validateEnv({
        ...baseEnv,
        NODE_ENV: "production",
        CORS_ORIGINS: "https://crm.example.com",
        AUTH_COOKIE_SAMESITE: "none",
      });
      expect(env.AUTH_COOKIE_SAMESITE).toBe("none");
    });

    it("rejects none outside production, where the cookie would not be Secure", () => {
      expect(() => validateEnv({ ...baseEnv, AUTH_COOKIE_SAMESITE: "none" })).toThrow(
        /requires NODE_ENV=production/,
      );
    });

    it("rejects an unknown value", () => {
      expect(() => validateEnv({ ...baseEnv, AUTH_COOKIE_SAMESITE: "sometimes" })).toThrow(
        /AUTH_COOKIE_SAMESITE/,
      );
    });
  });
});
