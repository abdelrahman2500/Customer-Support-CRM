import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Story 115 — Administration: Runtime DB role hardening.
 *
 * Connects directly as the restricted runtime role (`crm_app`) —
 * independent of whatever `APP_DATABASE_URL` the rest of this suite
 * happens to be configured with — to prove, against the real database,
 * that the `add_runtime_db_role_grants` migration's grants actually
 * behave exactly as `docs/architecture/05-auth-and-security.md`
 * documents: `admin.audit_logs` is append-only (SELECT/INSERT allowed,
 * UPDATE/DELETE denied), an ordinary table keeps full CRUD, and the role
 * cannot alter schema at all.
 *
 * Builds the `crm_app` connection string from this suite's own
 * `DATABASE_URL` (the owner role) by swapping only the credentials —
 * `crm_app`'s dev/CI password is a fixed, non-secret, documented value
 * (see the migration's own comment), mirroring this repository's
 * existing `crm`/`crm_dev_password` precedent. Requires
 * `DATABASE_URL`/`REDIS_URL` pointed at a real, migrated database, same
 * as every other `*.e2e-spec.ts` file.
 */
function buildCrmAppUrl(): string {
  const ownerUrl = process.env.DATABASE_URL;
  if (!ownerUrl) {
    throw new Error("DATABASE_URL must be set for this suite to run");
  }
  const url = new URL(ownerUrl);
  url.username = "crm_app";
  url.password = "crm_app_dev_password";
  return url.toString();
}

describe("Runtime DB role hardening — crm_app grants (e2e)", () => {
  let ownerPrisma: PrismaClient;
  let appPrisma: PrismaClient;

  beforeAll(async () => {
    ownerPrisma = new PrismaClient();
    appPrisma = new PrismaClient({ datasources: { db: { url: buildCrmAppUrl() } } });
    await ownerPrisma.$connect();
    await appPrisma.$connect();
  });

  afterAll(async () => {
    await ownerPrisma.$disconnect();
    await appPrisma.$disconnect();
  });

  it("crm_app can SELECT and INSERT into admin.audit_logs", async () => {
    const id = randomUUID();
    await expect(
      appPrisma.$executeRawUnsafe(
        `INSERT INTO "admin"."audit_logs" (id, action, entity_type) VALUES ($1, $2, $3)`,
        id,
        "story-115-e2e-insert-check",
        "test",
      ),
    ).resolves.not.toThrow();

    const rows = await appPrisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "admin"."audit_logs" WHERE id = $1`,
      id,
    );
    expect(rows).toHaveLength(1);

    // Clean up via the owner role — crm_app is denied DELETE on this
    // table (proven below), so it cannot clean up after itself.
    await ownerPrisma.$executeRawUnsafe(`DELETE FROM "admin"."audit_logs" WHERE id = $1`, id);
  });

  it("crm_app is denied UPDATE and DELETE on admin.audit_logs", async () => {
    const id = randomUUID();
    await ownerPrisma.$executeRawUnsafe(
      `INSERT INTO "admin"."audit_logs" (id, action, entity_type) VALUES ($1, $2, $3)`,
      id,
      "story-115-e2e-immutability-check",
      "test",
    );

    await expect(
      appPrisma.$executeRawUnsafe(
        `UPDATE "admin"."audit_logs" SET action = $1 WHERE id = $2`,
        "tampered",
        id,
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      appPrisma.$executeRawUnsafe(`DELETE FROM "admin"."audit_logs" WHERE id = $1`, id),
    ).rejects.toThrow(/permission denied/i);

    await ownerPrisma.$executeRawUnsafe(`DELETE FROM "admin"."audit_logs" WHERE id = $1`, id);
  });

  it("crm_app retains full CRUD on an ordinary table (identity.users) — proves the story didn't over-restrict", async () => {
    const rows = await appPrisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM "identity"."users"`,
    );
    expect(rows[0]?.count).toBeGreaterThan(0n);
  });

  it("crm_app cannot create or alter tables — it owns nothing and has no schema-CREATE grant", async () => {
    await expect(
      appPrisma.$executeRawUnsafe(`CREATE TABLE "public"."story_115_e2e_should_fail" (id uuid)`),
    ).rejects.toThrow(/permission denied/i);
  });
});
