import { describe, expect, it } from "vitest";
import {
  describeRuntimeDatabase,
  parseDatabaseTarget,
  redactDatabaseUrl,
  resolveRuntimeDatabaseUrl,
} from "./database-url";

const OWNER = "postgresql://crm:crm_dev_password@localhost:5432/crm?schema=public";
const RUNTIME = "postgresql://crm_app:crm_app_dev_password@localhost:5432/crm?schema=public";

describe("resolveRuntimeDatabaseUrl", () => {
  it("uses APP_DATABASE_URL when it is set", () => {
    expect(resolveRuntimeDatabaseUrl(OWNER, RUNTIME)).toEqual({
      url: RUNTIME,
      source: "APP_DATABASE_URL",
    });
  });

  it("falls back to DATABASE_URL when APP_DATABASE_URL is unset", () => {
    expect(resolveRuntimeDatabaseUrl(OWNER, undefined)).toEqual({
      url: OWNER,
      source: "DATABASE_URL",
    });
  });

  /**
   * The regression this helper exists for. `env.validation.ts` normalizes a
   * blank optional value to `undefined`, but `ConfigService.get()` falls
   * through to raw `process.env` when the validated value is `undefined` —
   * so a deployment platform that materializes APP_DATABASE_URL as "" still
   * hands `""` to the caller, and `??` does not replace it. Prisma then
   * rejects the empty datasource URL and the container crash-loops.
   */
  it("treats a blank APP_DATABASE_URL as unset, not as a connection string", () => {
    for (const blank of ["", " ", "\t", "\n  "]) {
      expect(resolveRuntimeDatabaseUrl(OWNER, blank)).toEqual({
        url: OWNER,
        source: "DATABASE_URL",
      });
    }
  });

  it("trims surrounding whitespace off a real APP_DATABASE_URL", () => {
    expect(resolveRuntimeDatabaseUrl(OWNER, `  ${RUNTIME}  `)).toEqual({
      url: RUNTIME,
      source: "APP_DATABASE_URL",
    });
  });
});

describe("parseDatabaseTarget", () => {
  it("extracts host, port and database name", () => {
    expect(parseDatabaseTarget(OWNER)).toEqual({
      host: "localhost",
      port: "5432",
      database: "crm",
    });
  });

  it("defaults the port to Postgres' own 5432 when the URL omits it", () => {
    expect(parseDatabaseTarget("postgresql://user:pw@db.internal/crm")).toEqual({
      host: "db.internal",
      port: "5432",
      database: "crm",
    });
  });

  it("returns null for an unset or unparseable value", () => {
    expect(parseDatabaseTarget(undefined)).toBeNull();
    expect(parseDatabaseTarget("not-a-url")).toBeNull();
  });
});

describe("redactDatabaseUrl", () => {
  it("replaces the password but keeps everything diagnosable", () => {
    const redacted = redactDatabaseUrl(OWNER);
    expect(redacted).not.toContain("crm_dev_password");
    expect(redacted).toContain("localhost:5432");
    expect(redacted).toContain("/crm");
    expect(redacted).toContain("schema=public");
    expect(redacted).toContain("***");
  });

  it("never echoes an unparseable value, which could itself be a pasted secret", () => {
    expect(redactDatabaseUrl("s3cret-looking-garbage")).toBe("(unparseable connection string)");
  });

  it("reports an unset value as such", () => {
    expect(redactDatabaseUrl(undefined)).toBe("(unset)");
  });
});

describe("describeRuntimeDatabase", () => {
  it("reports DATABASE_URL as the source when APP_DATABASE_URL is unset", () => {
    const result = describeRuntimeDatabase(OWNER, undefined);
    expect(result.source).toBe("DATABASE_URL");
    expect(result.warning).toBeNull();
    expect(result.redacted).not.toContain("crm_dev_password");
  });

  it("reports APP_DATABASE_URL as the source when it is set", () => {
    const result = describeRuntimeDatabase(OWNER, RUNTIME);
    expect(result.source).toBe("APP_DATABASE_URL");
    expect(result.redacted).toContain("crm_app");
    expect(result.redacted).not.toContain("crm_app_dev_password");
  });

  it("does not warn when both URLs target the same database", () => {
    expect(describeRuntimeDatabase(OWNER, RUNTIME).warning).toBeNull();
  });

  it("does not warn on a different host alone — a connection pooler is a legitimate deployment", () => {
    const pooled = "postgresql://crm_app:pw@pooler.example.com:6543/crm";
    expect(describeRuntimeDatabase(OWNER, pooled).warning).toBeNull();
  });

  it("warns when the runtime and migration URLs name different databases", () => {
    const wrongDatabase = "postgresql://crm_app:pw@localhost:5432/crm_staging";
    const result = describeRuntimeDatabase(OWNER, wrongDatabase);
    expect(result.warning).toContain("crm_staging");
    expect(result.warning).toContain("crm");
    expect(result.warning).toContain("migrations and seed did not apply to");
  });

  it("does not warn when either URL is unparseable — there is nothing to compare", () => {
    expect(describeRuntimeDatabase("garbage", RUNTIME).warning).toBeNull();
    expect(describeRuntimeDatabase(OWNER, "garbage").warning).toBeNull();
  });

  it("reports DATABASE_URL as the source for a blank APP_DATABASE_URL, matching PrismaService", () => {
    const result = describeRuntimeDatabase(OWNER, "");
    expect(result.source).toBe("DATABASE_URL");
    expect(result.warning).toBeNull();
    expect(result.redacted).toContain("/crm");
  });
});
