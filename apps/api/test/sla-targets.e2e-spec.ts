import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * `EventEmitter2.emit()` (used by `TicketsService.createTicket`) does not
 * await its listeners — `SlaTargetListener` runs several real, sequential
 * DB round-trips (`ticket.findUnique` → `slaPolicy.findMany` →
 * `slaTicketTarget.create`) after the HTTP response for `POST /tickets` has
 * already been sent. Unlike `TicketHistoryListener` (a single write), that
 * is not reliably finished by the time an immediate follow-up `GET` runs —
 * this suite is the discovery of that gap. Polling briefly here tests the
 * real, fire-and-forget listener behavior; it is not a change to it.
 */
async function waitForSlaTarget(
  httpServer: Parameters<typeof request>[0],
  accessToken: string,
  ticketId: string,
  { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<request.Response> {
  const deadline = Date.now() + timeoutMs;
  let lastResponse: request.Response;
  do {
    lastResponse = await request(httpServer)
      .get(`/api/v1/tickets/${ticketId}/sla-target`)
      .set("Authorization", `Bearer ${accessToken}`);
    if (lastResponse.status === 200) {
      return lastResponse;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return lastResponse;
}

/**
 * Integration suite for `GET /tickets/:id/sla-target` and the
 * `SlaTargetListener` it reads from.
 *
 * Bootstraps the REAL `AppModule` — same guards
 * (`AuthGuard`/`PermissionsGuard`/`ThrottlerGuard`), same `AuditInterceptor`,
 * same `TenantMiddleware`, same global `ValidationPipe`/prefix as
 * `src/main.ts` — against a REAL Postgres/Redis, exactly like
 * `sla-policies.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL` pointed at
 * a real, migrated, and SEEDED database.
 *
 * This suite creates its own dedicated `SlaPolicy` fixture scoped by a
 * freshly-generated `category` value, rather than relying on (or colliding
 * with) `sla-policies.e2e-spec.ts`'s own leftover fixtures in the shared
 * seeded database.
 */
describe("SLA Targets (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let matchingCategory: string;
  let matchingTicketId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();

    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must be set for this suite to run");
    }
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    adminAccessToken = loginResponse.body.accessToken;

    // A fresh SlaPolicy scoped only by a randomly-generated category — no
    // department/priority — so it cannot collide with any leftover fixture
    // another suite created in this shared database.
    matchingCategory = `sla-target-e2e-${randomUUID()}`;
    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ category: matchingCategory, responseTargetMinutes: 30, resolutionTargetMinutes: 240 })
      .expect(201);

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `SLA target e2e customer ${randomUUID()}` })
      .expect(201);

    const matchingTicket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: customer.body.id,
        subject: "Matching-policy ticket",
        category: matchingCategory,
      })
      .expect(201);
    matchingTicketId = matchingTicket.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${matchingTicketId}/sla-target`)
      .expect(401);
  });

  it("computes a target when a matching, active policy exists", async () => {
    const response = await waitForSlaTarget(app.getHttpServer(), adminAccessToken, matchingTicketId);
    expect(response.status).toBe(200);

    expect(response.body.ticketId).toBe(matchingTicketId);
    const responseTargetAt = new Date(response.body.responseTargetAt).getTime();
    const resolutionTargetAt = new Date(response.body.resolutionTargetAt).getTime();
    // resolutionTargetMinutes (240) > responseTargetMinutes (30), and both
    // are walked forward from the same instant — resolution can never land
    // before response, whether or not business-hours math applies (Story 13).
    expect(resolutionTargetAt).toBeGreaterThanOrEqual(responseTargetAt);
  });

  it("produces no target when no policy matches", async () => {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `SLA target e2e customer ${randomUUID()}` })
      .expect(201);

    const noMatchTicket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: customer.body.id,
        subject: "No-matching-policy ticket",
        category: `sla-target-e2e-no-match-${randomUUID()}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${noMatchTicket.body.id}/sla-target`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("returns 404 for an unknown ticket id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${randomUUID()}/sla-target`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("rejects an Agent-role user attempting to read an SLA target (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-sla-target-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent SLA Target",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);

    const agentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);
    const agentAccessToken = agentLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${matchingTicketId}/sla-target`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
  });
});
