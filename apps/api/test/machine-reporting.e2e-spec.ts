import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Story 133 — `GET /integrations/reports/ticket-volume`, the first REAL
 * production route reachable by an API key.
 *
 * Unlike `api-keys.e2e-spec.ts`, which exercises the guard against
 * `TestMachineController` (a fixture the suite registers itself and that is
 * never part of `AppModule`), this suite bootstraps the plain `AppModule`
 * with NO extra controllers. Every route under test here is one the
 * application really serves in production — that is the whole point of the
 * story, so registering anything extra would defeat it.
 */
describe("Integrations — machine-facing reporting (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  const MACHINE_ROUTE = "/api/v1/integrations/reports/ticket-volume";
  const HUMAN_ROUTE = "/api/v1/reports/ticket-volume";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();

    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must both be set for this suite to run");
    }
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    adminAccessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createApiKey(
    scopes: string[] = ["integration:read"],
  ): Promise<{ id: string; rawKey: string }> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/integrations/api-keys")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ label: `story-133 key ${randomUUID()}`, scopes })
      .expect(201);
    return response.body;
  }

  function totalOf(rows: Array<{ status: string; count: number }>): number {
    return rows.reduce((sum, row) => sum + row.count, 0);
  }

  describe("authentication and scope", () => {
    it("serves a key holding integration:read", async () => {
      const { rawKey } = await createApiKey();

      const response = await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      for (const row of response.body) {
        expect(row).toEqual({ status: expect.any(String), count: expect.any(Number) });
      }
    });

    it("rejects a key holding only integration:write with 403", async () => {
      const { rawKey } = await createApiKey(["integration:write"]);

      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(403);
    });

    it("rejects a revoked key with 401", async () => {
      const { id, rawKey } = await createApiKey();
      await request(app.getHttpServer())
        .delete(`/api/v1/integrations/api-keys/${id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(401);
    });

    it("rejects a request with no credentials at all with 401", async () => {
      await request(app.getHttpServer()).get(MACHINE_ROUTE).expect(401);
    });

    it("rejects an unknown bearer token with 401", async () => {
      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .set("Authorization", `Bearer not-a-real-key-${randomUUID()}`)
        .expect(401);
    });
  });

  describe("shared logic with the human route", () => {
    // If these two ever diverge, the machine route has grown its own copy of
    // the query — which this story exists to avoid.
    it("returns exactly what the human /reports/ticket-volume returns for the same branch", async () => {
      const { rawKey } = await createApiKey();

      const machine = await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(200);
      const human = await request(app.getHttpServer())
        .get(HUMAN_ROUTE)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(machine.body).toEqual(human.body);
    });

    it("honours the shared date-range filter", async () => {
      const { rawKey } = await createApiKey();

      const response = await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .query({ from: "1970-01-01", to: "1970-01-02" })
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(200);

      expect(totalOf(response.body)).toBe(0);
    });

    it("rejects a malformed date with 400, via the shared DTO validation", async () => {
      const { rawKey } = await createApiKey();

      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .query({ from: "not-a-date" })
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(400);
    });
  });

  describe("tenant isolation", () => {
    // A key is bound to its own branch by `ApiKeyGuard`, from the durable
    // `ApiKey` row — nothing the caller sends can move it.
    //
    // Deliberately proven WITHOUT creating a second branch or a ticket in
    // one. An earlier draft of this test did exactly that and polluted the
    // shared dev database in two ways that broke other suites:
    // `POST /auth/switch-branch` PERSISTS the caller's active branch
    // (Story 118's `User.activeBranchId`), so it stranded the seeded admin
    // in a throwaway branch and every later suite created its fixtures
    // there; and a ticket in a second branch permanently invalidates
    // `reporting.e2e-spec.ts`'s own documented assumption that "this dev
    // database seeds exactly one Branch, so a cross-branch result is
    // necessarily identical to the single-branch one". The assertions below
    // prove the same property against data this suite alone creates.
    it("reflects a new ticket in the key's own branch", async () => {
      const { rawKey } = await createApiKey();

      const before = totalOf(
        (
          await request(app.getHttpServer())
            .get(MACHINE_ROUTE)
            .set("Authorization", `Bearer ${rawKey}`)
            .expect(200)
        ).body,
      );

      const customer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Story 133 customer ${randomUUID()}` })
        .expect(201);
      await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId: customer.body.id, subject: `Story 133 ticket ${randomUUID()}` })
        .expect(201);

      const after = totalOf(
        (
          await request(app.getHttpServer())
            .get(MACHINE_ROUTE)
            .set("Authorization", `Bearer ${rawKey}`)
            .expect(200)
        ).body,
      );

      // The key is genuinely reading the branch it was issued against — the
      // same branch the admin just wrote to — not a cached or empty scope.
      expect(after).toBe(before + 1);
    });

    // The caller cannot name a branch: no route or DTO accepts one, and the
    // global `forbidNonWhitelisted` ValidationPipe rejects the attempt
    // outright. Combined with `ApiKeyGuard` resolving `branchId` solely from
    // the `ApiKey` row, there is no input path by which a key could read
    // another branch's data.
    it("gives the caller no way to name a different branch", async () => {
      const { rawKey } = await createApiKey();

      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .query({ branchId: randomUUID() })
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(400);
    });

    // `ApiKeyGuard` sets `roles: []` on purpose, so `resolveBranchFilter`'s
    // `report:read-cross-branch` lookup finds nothing. No Story 133 code
    // produces this 403 — it is pinned so neither side can later widen a
    // key's reach across branches unnoticed.
    it("refuses crossBranch=true for an API key with 403", async () => {
      const { rawKey } = await createApiKey();

      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .query({ crossBranch: "true" })
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(403);
    });

    it("still serves crossBranch=false for an API key", async () => {
      const { rawKey } = await createApiKey();

      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .query({ crossBranch: "false" })
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(200);
    });
  });

  describe("human access is preserved", () => {
    it("still serves a normal agent JWT, with ApiKeyGuard no-opping", async () => {
      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
    });

    // The disclosed trade-off of omitting `@RequirePermissions` here. Pinned
    // deliberately so it stays visible rather than being discovered later —
    // see `MachineReportingController`'s own doc comment.
    it("serves an Agent-role JWT without report:read, unlike the human /reports route", async () => {
      const roles = await request(app.getHttpServer())
        .get("/api/v1/identity/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
      const me = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const agentEmail = `agent-story133-${randomUUID()}@example.com`;
      const agentPassword = "agent-test-password-123";
      await request(app.getHttpServer())
        .post("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email: agentEmail,
          password: agentPassword,
          fullName: "Story 133 Agent",
          branchId: me.body.branchId,
          departmentId: me.body.departmentId ?? undefined,
          roleId: agentRole.id,
        })
        .expect(201);
      const agentLogin = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: agentEmail, password: agentPassword })
        .expect(200);
      const agentToken = agentLogin.body.accessToken as string;

      // The human route still enforces `report:read` — unchanged by this story.
      await request(app.getHttpServer())
        .get(HUMAN_ROUTE)
        .set("Authorization", `Bearer ${agentToken}`)
        .expect(403);

      // The machine route deliberately has no `@RequirePermissions`.
      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .set("Authorization", `Bearer ${agentToken}`)
        .expect(200);
    });
  });

  describe("key bookkeeping", () => {
    it("records lastUsedAt after a successful machine call", async () => {
      const { id, rawKey } = await createApiKey();

      await request(app.getHttpServer())
        .get(MACHINE_ROUTE)
        .set("Authorization", `Bearer ${rawKey}`)
        .expect(200);

      // `ApiKeyGuard` updates `lastUsedAt` best-effort (fire-and-forget), so
      // poll briefly rather than asserting immediately — the write is not
      // awaited by the request it observes.
      await expect
        .poll(async () => {
          const list = await request(app.getHttpServer())
            .get("/api/v1/integrations/api-keys")
            .set("Authorization", `Bearer ${adminAccessToken}`)
            .expect(200);
          return list.body.find((row: { id: string }) => row.id === id)?.lastUsedAt ?? null;
        })
        .not.toBeNull();
    });
  });
});
