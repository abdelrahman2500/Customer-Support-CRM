import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * `EventEmitter2.emit()` (used by `TicketsService.updateTicket`) does not
 * await its listeners — `SlaTargetListener.onTicketRecategorized` runs
 * several real, sequential DB round-trips after the HTTP response for
 * `PATCH /tickets/:id` has already been sent. Polling briefly here tests the
 * real, fire-and-forget listener behavior; it is not a change to it. Mirrors
 * `sla-targets.e2e-spec.ts`'s `waitForSlaTarget` exactly.
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
 * Polls until `GET /tickets/:id/sla-target` returns `404` — used for the
 * "recategorized into a non-matching category" scenario, where a
 * previously-existing target must be removed asynchronously.
 */
async function waitForNoSlaTarget(
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
    if (lastResponse.status === 404) {
      return lastResponse;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return lastResponse;
}

/**
 * Integration suite for Story 16 — `ticket.recategorized` and SLA target
 * recomputation, exercised end-to-end through `PATCH /tickets/:id`.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, exactly like
 * `sla-targets.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL` pointed at
 * a real, migrated, and SEEDED database.
 *
 * Documented exception to the "build fixtures through the real HTTP API"
 * convention `tickets.e2e-spec.ts` otherwise follows: no `Department`
 * creation HTTP endpoint exists anywhere in this repository (confirmed
 * during Story 16 planning — `prisma/seed.ts` creates exactly one
 * Department, "General", and no controller registers a `department` route).
 * The `departmentId`-change scenario below therefore creates its second
 * `Department` fixture directly via `PrismaService`, resolved from the same
 * compiled `TestingModule` the rest of this suite already boots.
 */
describe("Ticket Recategorization and SLA Target Recomputation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAccessToken: string;
  let adminBranchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);

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

  it("recomputes the SLA target when a ticket's category is changed to match a different policy", async () => {
    const categoryA = `ticket-recat-e2e-a-${randomUUID()}`;
    const categoryB = `ticket-recat-e2e-b-${randomUUID()}`;

    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ category: categoryA, responseTargetMinutes: 30, resolutionTargetMinutes: 240 })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ category: categoryB, responseTargetMinutes: 10, resolutionTargetMinutes: 60 })
      .expect(201);

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Ticket recat e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: customer.body.id,
        subject: "Recategorization e2e ticket",
        category: categoryA,
      })
      .expect(201);
    const ticketId = ticket.body.id;

    const initialTarget = await waitForSlaTarget(app.getHttpServer(), adminAccessToken, ticketId);
    expect(initialTarget.status).toBe(200);
    const initialResponseTargetAt = new Date(initialTarget.body.responseTargetAt).getTime();
    const initialResolutionTargetAt = new Date(initialTarget.body.resolutionTargetAt).getTime();

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ category: categoryB })
      .expect(200);

    // Poll until the target's slaPolicyId (and therefore its timestamps)
    // actually changed — the listener is fire-and-forget.
    const deadline = Date.now() + 5000;
    let recomputed: request.Response;
    do {
      recomputed = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/sla-target`)
        .set("Authorization", `Bearer ${adminAccessToken}`);
      if (
        recomputed.status === 200 &&
        new Date(recomputed.body.responseTargetAt).getTime() !== initialResponseTargetAt
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);

    expect(recomputed.status).toBe(200);
    const recomputedResponseTargetAt = new Date(recomputed.body.responseTargetAt).getTime();
    const recomputedResolutionTargetAt = new Date(recomputed.body.resolutionTargetAt).getTime();
    // Policy B's minute counts (10/60) are strictly smaller than Policy A's
    // (30/240) — the recomputed target must be strictly tighter than the
    // original, proving recomputation used Policy B, not a stale Policy A
    // target left untouched.
    //
    // Both the initial and recomputed resolution targets are walked forward
    // from the SAME anchor (`ticket.createdAt`) by the same business-hours
    // -aware calculator (Story 13) — a smaller minute count from a fixed
    // anchor can never land later than a larger one, so comparing the two
    // resolution targets directly is a safe, time-of-day-independent
    // invariant. A fixed wall-clock gap between the response and resolution
    // targets is NOT safe: business-hours walk-forward can push either
    // target across a closed-hours/weekend boundary independently of the
    // other, so their difference is unbounded in general (reproduced: this
    // assertion previously failed when the ticket was created close enough
    // to the end of business hours that the 60-minute resolution target
    // rolled into the next open window while the 10-minute response target
    // did not). Mirrors `sla-targets.e2e-spec.ts`'s own
    // `resolutionTargetAt >= responseTargetAt` business-hours-safe pattern.
    expect(recomputedResponseTargetAt).not.toBe(initialResponseTargetAt);
    expect(recomputedResolutionTargetAt).toBeLessThan(initialResolutionTargetAt);
    expect(recomputedResolutionTargetAt).toBeGreaterThanOrEqual(recomputedResponseTargetAt);
  });

  it("removes the SLA target when recategorized into a category no active policy matches", async () => {
    const matchingCategory = `ticket-recat-e2e-match-${randomUUID()}`;
    const nonMatchingCategory = `ticket-recat-e2e-nomatch-${randomUUID()}`;

    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ category: matchingCategory, responseTargetMinutes: 30, resolutionTargetMinutes: 240 })
      .expect(201);

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Ticket recat e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: customer.body.id,
        subject: "Recategorization-to-no-match e2e ticket",
        category: matchingCategory,
      })
      .expect(201);
    const ticketId = ticket.body.id;

    await waitForSlaTarget(app.getHttpServer(), adminAccessToken, ticketId).then((response) =>
      expect(response.status).toBe(200),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ category: nonMatchingCategory })
      .expect(200);

    const afterRecategorization = await waitForNoSlaTarget(app.getHttpServer(), adminAccessToken, ticketId);
    expect(afterRecategorization.status).toBe(404);
  });

  it("accepts a departmentId change and reflects it on the ticket", async () => {
    // No Department-creation HTTP endpoint exists in this repository (see
    // this file's own doc comment) — the second Department fixture is
    // created directly via Prisma, scoped to the same branch the seeded
    // admin operates in.
    const newDepartment = await prisma.department.create({
      data: { branchId: adminBranchId, name: `Ticket Recat E2E Dept ${randomUUID()}` },
    });

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Ticket recat e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: customer.body.id,
        subject: "Department recategorization e2e ticket",
      })
      .expect(201);
    const ticketId = ticket.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ departmentId: newDepartment.id })
      .expect(200);

    const updatedTicket = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(updatedTicket.body.departmentId).toBe(newDepartment.id);
  });

  it("rejects a departmentId outside the caller's branch", async () => {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Ticket recat e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: customer.body.id,
        subject: "Out-of-scope department e2e ticket",
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticket.body.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ departmentId: randomUUID() })
      .expect(404);
  });
});
