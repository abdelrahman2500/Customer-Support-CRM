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

/**
 * A *valid* production environment. Beyond `baseEnv` it must supply
 * CORS_ORIGINS and the three object-storage values, whose schema defaults
 * are local-development-only — see the "production-only required values"
 * block below.
 */
const productionEnv = {
  ...baseEnv,
  NODE_ENV: "production",
  CORS_ORIGINS: "https://crm.example.com",
  S3_ENDPOINT: "https://s3.example.com",
  S3_ACCESS_KEY: "prod-access-key",
  S3_SECRET_KEY: "prod-secret-key",
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

    /**
     * A *defaulted* field, not an optional one. `z.string().default("15m")`
     * only applies the default for `undefined`, so a blank value would
     * otherwise sign access tokens with an empty `expiresIn`.
     */
    it("falls back to the default JWT_ACCESS_TTL when the value is blank", () => {
      expect(validateEnv({ ...baseEnv, JWT_ACCESS_TTL: "" }).JWT_ACCESS_TTL).toBe("15m");
      expect(validateEnv({ ...baseEnv, JWT_ACCESS_TTL: "  " }).JWT_ACCESS_TTL).toBe("15m");
      expect(validateEnv({ ...baseEnv }).JWT_ACCESS_TTL).toBe("15m");
    });

    it("keeps a real JWT_ACCESS_TTL override", () => {
      expect(validateEnv({ ...baseEnv, JWT_ACCESS_TTL: "5m" }).JWT_ACCESS_TTL).toBe("5m");
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
        ...productionEnv,
        CORS_ORIGINS: "https://crm.example.com,https://portal.example.com",
      });
      expect(env.CORS_ORIGINS).toBe("https://crm.example.com,https://portal.example.com");
    });

    it("rejects an entry that can never match a browser Origin header", () => {
      expect(() =>
        validateEnv({ ...productionEnv, CORS_ORIGINS: "https://crm.example.com/login" }),
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
      const env = validateEnv({ ...productionEnv, AUTH_COOKIE_SAMESITE: "none" });
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

  describe("production-only required values with local-development defaults", () => {
    it("accepts a fully-configured production environment", () => {
      const env = validateEnv({ ...productionEnv });
      expect(env.S3_ENDPOINT).toBe("https://s3.example.com");
      // S3_BUCKET keeps its default — a bucket name is not
      // environment-specific and the storage service creates it if absent.
      expect(env.S3_BUCKET).toBe("crm-attachments");
    });

    it("keeps the local MinIO defaults outside production", () => {
      const env = validateEnv({ ...baseEnv });
      expect(env.S3_ENDPOINT).toBe("http://localhost:9000");
      expect(env.S3_ACCESS_KEY).toBe("minioadmin");
    });

    it.each(["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"])(
      "rejects production when %s is absent, rather than silently using the local default",
      (key) => {
        const env: Record<string, unknown> = { ...productionEnv };
        delete env[key];
        expect(() => validateEnv(env)).toThrow(
          new RegExp(`${key}: must be set explicitly in production`),
        );
      },
    );

    it.each(["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"])(
      "rejects production when %s is present but blank",
      (key) => {
        expect(() => validateEnv({ ...productionEnv, [key]: "  " })).toThrow(
          new RegExp(`${key}: must be set explicitly in production`),
        );
      },
    );

    it("reports schema issues and missing production values together", () => {
      const env: Record<string, unknown> = { ...productionEnv, CORS_ORIGINS: "" };
      delete env.S3_ENDPOINT;
      let message = "";
      try {
        validateEnv(env);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/CORS_ORIGINS is required in production/);
      expect(message).toMatch(/S3_ENDPOINT: must be set explicitly in production/);
    });
  });
});
