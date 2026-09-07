import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * RM-25 — SLA Pause/Resume ("On Hold" Clock). Integration suite for
 * `POST /tickets/:id/hold`/`resume` and the real
 * `TICKET_ON_HOLD_EVENT`/`TICKET_RESUMED_EVENT` → `SlaHoldListener` →
 * `SlaTicketTarget` wiring — mirrors `sla-targets.e2e-spec.ts`'s own
 * `waitForSlaTarget` polling precedent exactly: `TicketsService.holdTicket`/
 * `resumeTicket` emit via `EventEmitter2#emit`, which does not await
 * `SlaHoldListener`, so an immediate follow-up `GET` can run before the
 * listener's own DB round-trip finishes.
 *
 * Bootstraps the REAL `AppModule` — same guards, same `AuditInterceptor`,
 * same `TenantMiddleware`, same global `ValidationPipe`/prefix as
 * `src/main.ts` — against a REAL Postgres/Redis. This suite creates its own
 * dedicated `SlaPolicy` fixture scoped by a freshly-generated category, so
 * it cannot collide with any other suite's leftover fixtures in the shared
 * seeded database.
 */
describe("Tickets — SLA Pause/Resume (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let categoryId: string;
  let customerId: string;

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
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must both be set for this suite to run");
    }
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    adminAccessToken = loginResponse.body.accessToken;

    const category = await request(app.getHttpServer())
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `sla-hold-e2e-${randomUUID()}` })
      .expect(201);
    categoryId = category.body.id;
    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ categoryId, responseTargetMinutes: 60, resolutionTargetMinutes: 480 })
      .expect(201);

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `SLA hold e2e customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTicketWithTarget(): Promise<{ id: string; target: request.Response["body"] }> {
    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, subject: "SLA hold e2e fixture", categoryId })
      .expect(201);

    const target = await pollSlaTarget(ticket.body.id, (body) => body.responseTargetAt !== undefined);
    return { id: ticket.body.id, target };
  }

  async function pollSlaTarget(
    ticketId: string,
    isReady: (body: request.Response["body"]) => boolean,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<request.Response["body"]> {
    const deadline = Date.now() + timeoutMs;
    do {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/sla-target`)
        .set("Authorization", `Bearer ${adminAccessToken}`);
      if (response.status === 200 && isReady(response.body)) {
        return response.body;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for SLA target on ticket ${ticketId} to reach the expected state`);
  }

  it("rejects an unauthenticated request to hold/resume", async () => {
    const { id } = await createTicketWithTarget();

    await request(app.getHttpServer()).post(`/api/v1/tickets/${id}/hold`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/tickets/${id}/resume`).expect(401);
  });

  it("places a ticket's SLA target on hold, then resumes it with both targets shifted forward by the held duration", async () => {
    const { id, target } = await createTicketWithTarget();
    const originalResponseTargetAt = new Date(target.responseTargetAt).getTime();
    const originalResolutionTargetAt = new Date(target.resolutionTargetAt).getTime();
    expect(target.onHoldSince).toBeNull();

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${id}/hold`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);

    const heldTarget = await pollSlaTarget(id, (body) => body.onHoldSince !== null);
    expect(heldTarget.onHoldSince).not.toBeNull();
    // Neither target moved yet — only resuming shifts them.
    expect(new Date(heldTarget.responseTargetAt).getTime()).toBe(originalResponseTargetAt);
    expect(new Date(heldTarget.resolutionTargetAt).getTime()).toBe(originalResolutionTargetAt);

    // Held for a real, if short, duration before resuming.
    await new Promise((resolve) => setTimeout(resolve, 250));

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${id}/resume`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);

    const resumedTarget = await pollSlaTarget(id, (body) => body.onHoldSince === null);
    const newResponseTargetAt = new Date(resumedTarget.responseTargetAt).getTime();
    const newResolutionTargetAt = new Date(resumedTarget.resolutionTargetAt).getTime();

    // Both targets were still pending when the hold began (response target
    // is 60 minutes out, resolution 480 — nowhere near passed in this
    // test's own short lifetime), so both must have shifted forward, by
    // the same (real, non-zero) amount.
    expect(newResponseTargetAt).toBeGreaterThan(originalResponseTargetAt);
    expect(newResolutionTargetAt).toBeGreaterThan(originalResolutionTargetAt);
    expect(newResponseTargetAt - originalResponseTargetAt).toBe(
      newResolutionTargetAt - originalResolutionTargetAt,
    );
  });

  it("is a harmless no-op to hold/resume a ticket with no SLA target at all", async () => {
    const noMatchCategory = await request(app.getHttpServer())
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `sla-hold-e2e-no-match-${randomUUID()}` })
      .expect(201);
    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, subject: "No SLA target fixture", categoryId: noMatchCategory.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticket.body.id}/hold`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticket.body.id}/resume`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticket.body.id}/sla-target`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });
});
