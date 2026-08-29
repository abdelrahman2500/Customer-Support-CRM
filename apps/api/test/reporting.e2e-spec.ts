import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { SLA_BREACHED_EVENT } from "../src/modules/sla-policies/sla-detection.events";

/**
 * Integration suite for Story 56 — `GET /reports/ticket-volume`,
 * `/reports/sla-compliance`, `/reports/csat`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `sla-escalations.e2e-spec.ts`/`sla-targets.e2e-spec.ts`, which this
 * suite combines: a fresh, randomly-categorized `SlaPolicy` fixture (so it
 * cannot collide with another suite's leftover policy in this shared
 * database — `sla-targets.e2e-spec.ts`'s own precedent) to produce a real
 * `SlaTicketTarget`, then `SLA_BREACHED_EVENT` emitted directly on the real,
 * compiled `EventEmitter2` (`sla-escalations.e2e-spec.ts`'s own precedent)
 * to produce a real `SlaEscalation`.
 *
 * Because the seeded admin's branch is shared with every other e2e suite in
 * this run, every assertion here is a *delta* (before vs. after a known
 * action), never an absolute count — the same technique this suite needs
 * precisely because, unlike every prior read-only report consumer, this one
 * aggregates across the *entire* branch rather than one ticket at a time.
 *
 * Branch isolation itself is not re-tested here: every query goes through
 * the exact same `TenantContext.requireBranchScope()` mechanism already
 * proven correct by every other branch-scoped e2e suite in this codebase
 * (`audit-logs`, `notifications-read`, `sla-escalations`, etc.) — this
 * suite instead focuses on the aggregation math that's genuinely new.
 */
describe("Reporting & Analytics (e2e)", () => {
  let app: INestApplication;
  let eventEmitter: EventEmitter2;
  let adminAccessToken: string;
  let adminBranchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    eventEmitter = moduleRef.get(EventEmitter2);

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

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    adminBranchId = me.body.branchId;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCustomer(): Promise<string> {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Reporting e2e customer ${randomUUID()}` })
      .expect(201);
    return customer.body.id;
  }

  async function createTicket(category?: string): Promise<string> {
    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: await createCustomer(),
        subject: "Reporting e2e ticket",
        ...(category ? { category } : {}),
      })
      .expect(201);
    return ticket.body.id;
  }

  async function getTicketVolume(): Promise<{ status: string; count: number }[]> {
    const response = await request(app.getHttpServer())
      .get("/api/v1/reports/ticket-volume")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  async function getSlaCompliance(): Promise<{
    totalWithTarget: number;
    breachedCount: number;
    compliantCount: number;
    complianceRate: number | null;
  }> {
    const response = await request(app.getHttpServer())
      .get("/api/v1/reports/sla-compliance")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  async function getCsat(): Promise<{ responseCount: number; averageRating: number | null }> {
    const response = await request(app.getHttpServer())
      .get("/api/v1/reports/csat")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  it("rejects unauthenticated requests on every route", async () => {
    await request(app.getHttpServer()).get("/api/v1/reports/ticket-volume").expect(401);
    await request(app.getHttpServer()).get("/api/v1/reports/sla-compliance").expect(401);
    await request(app.getHttpServer()).get("/api/v1/reports/csat").expect(401);
  });

  it("rejects an Agent-role user lacking report:read on every route (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-reporting-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Reporting",
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
      .get("/api/v1/reports/ticket-volume")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/reports/sla-compliance")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/reports/csat")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
  });

  it("reflects a real, newly-created OPEN ticket in the volume-by-status delta", async () => {
    const before = await getTicketVolume();
    const beforeOpen = before.find((row) => row.status === "OPEN")?.count ?? 0;

    await createTicket();

    const after = await getTicketVolume();
    const afterOpen = after.find((row) => row.status === "OPEN")?.count ?? 0;
    expect(afterOpen).toBe(beforeOpen + 1);
  });

  it("reflects a real SlaTicketTarget in totalWithTarget, then a real sla.breached escalation in breachedCount/complianceRate", async () => {
    const before = await getSlaCompliance();

    const matchingCategory = `reporting-e2e-${randomUUID()}`;
    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ category: matchingCategory, responseTargetMinutes: 30, resolutionTargetMinutes: 240 })
      .expect(201);
    const ticketId = await createTicket(matchingCategory);

    // SlaTargetListener runs fire-and-forget after POST /tickets responds
    // (sla-targets.e2e-spec.ts's own documented gap) — poll briefly until
    // the real SlaTicketTarget is visible via the existing endpoint.
    const deadline = Date.now() + 5000;
    let targetSeen = false;
    while (Date.now() < deadline && !targetSeen) {
      const targetResponse = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/sla-target`)
        .set("Authorization", `Bearer ${adminAccessToken}`);
      targetSeen = targetResponse.status === 200;
      if (!targetSeen) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    expect(targetSeen).toBe(true);

    const afterTarget = await getSlaCompliance();
    expect(afterTarget.totalWithTarget).toBe(before.totalWithTarget + 1);
    expect(afterTarget.breachedCount).toBe(before.breachedCount);

    eventEmitter.emit(SLA_BREACHED_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "resolution",
      targetAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const escalationDeadline = Date.now() + 5000;
    let afterBreach = afterTarget;
    while (Date.now() < escalationDeadline && afterBreach.breachedCount === before.breachedCount) {
      afterBreach = await getSlaCompliance();
      if (afterBreach.breachedCount === before.breachedCount) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    expect(afterBreach.breachedCount).toBe(before.breachedCount + 1);
    expect(afterBreach.totalWithTarget).toBe(before.totalWithTarget + 1);
    expect(afterBreach.compliantCount).toBe(afterBreach.totalWithTarget - afterBreach.breachedCount);
    expect(afterBreach.complianceRate).toBeCloseTo(
      afterBreach.compliantCount / afterBreach.totalWithTarget,
    );
  });

  it("reflects real portal-submitted feedback in responseCount/averageRating", async () => {
    const before = await getCsat();

    const contactEmail = `reporting-e2e-contact-${randomUUID()}@example.com`;
    const portalPassword = "a-strong-portal-password";
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Reporting e2e CSAT customer ${randomUUID()}` })
      .expect(201);
    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customer.body.id}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Reporting e2e Contact", email: contactEmail })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customer.body.id}/contacts/${contact.body.id}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);

    const portalLogin = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    const portalToken = portalLogin.body.accessToken as string;

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${portalToken}`)
      .send({ subject: "Reporting e2e CSAT ticket" })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticket.body.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "RESOLVED" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/portal/tickets/${ticket.body.id}/csat`)
      .set("Authorization", `Bearer ${portalToken}`)
      .send({ rating: 5 })
      .expect(201);

    const after = await getCsat();
    expect(after.responseCount).toBe(before.responseCount + 1);
    expect(after.averageRating).not.toBeNull();
  });
});
