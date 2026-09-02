import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SLA_AT_RISK_EVENT } from "../src/modules/sla-policies/sla-detection.events";

/**
 * Integration suite for Story 92 — `GET /notifications/unread-count` and
 * `PATCH /notifications/read-state` (the agent side).
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, mirroring
 * `notifications-read.e2e-spec.ts`'s (Story 36) own bootstrap/event-emission/
 * poll-for-row technique exactly.
 *
 * The critical isolation test creates a dedicated custom role (rather than
 * mutating the shared seeded `Agent` role, which `identity.e2e-spec.ts`'s
 * own disclosed test-isolation defect already pollutes across runs — see
 * `CLAUDE.md` §5) granted `notification:read`, and two brand-new users in
 * the admin's own branch under that role, so the test is fully
 * self-contained and deterministic regardless of run order.
 */
describe("Notifications — read-state (unread count + mark as read) (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  let adminAccessToken: string;
  let adminBranchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
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

  async function createTicket(): Promise<string> {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Notification read-state e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "Notification read-state e2e ticket" })
      .expect(201);
    return ticket.body.id;
  }

  async function emitSlaAtRiskAndWait(ticketId: string, targetAt: Date): Promise<void> {
    eventEmitter.emit(SLA_AT_RISK_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });
    const deadline = Date.now() + 5000;
    do {
      const rows = await prisma.notificationLog.findMany({
        where: { eventType: SLA_AT_RISK_EVENT, ticketId, targetType: "response", targetAt },
      });
      if (rows.length > 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    throw new Error("Timed out waiting for the NotificationLog row to be persisted");
  }

  /** Creates a fresh user under a dedicated, brand-new role granted no
   * permissions — used only for the 403 tests below. Story 100 — the
   * seeded `Agent` role itself now defaults to a real permission set
   * (including `notification:read`), so it can no longer stand in for "a
   * role with zero permissions"; a fresh empty-permission role, mirroring
   * `createNotificationReaderAgent`'s own "dedicated custom role" pattern,
   * is what actually has none. */
  async function createPlainAgent(): Promise<string> {
    const roleResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `No-Permissions E2E Role ${randomUUID()}` })
      .expect(201);

    const email = `read-state-plain-agent-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email,
        password: agentPassword,
        fullName: "Read-State Plain Agent",
        branchId: adminBranchId,
        roleId: roleResponse.body.id,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: agentPassword })
      .expect(200);
    return loginResponse.body.accessToken as string;
  }

  /** Creates a dedicated custom role granted only `notification:read`, then
   * a fresh user under it in the admin's branch — self-contained, never
   * touches the shared seeded `Agent` role. */
  async function createNotificationReaderAgent(label: string): Promise<string> {
    const roleResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Notification Read-State E2E Role ${label} ${randomUUID()}` })
      .expect(201);
    const roleId = roleResponse.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${roleId}/permissions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ permissionKeys: ["notification:read"] })
      .expect(200);

    const email = `read-state-${label}-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email,
        password: agentPassword,
        fullName: `Notification Read-State Agent ${label}`,
        branchId: adminBranchId,
        roleId,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: agentPassword })
      .expect(200);
    return loginResponse.body.accessToken as string;
  }

  async function getUnreadCount(token: string): Promise<number> {
    const response = await request(app.getHttpServer())
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    return response.body.unreadCount as number;
  }

  it("rejects an unauthenticated request on both routes", async () => {
    await request(app.getHttpServer()).get("/api/v1/notifications/unread-count").expect(401);
    await request(app.getHttpServer()).patch("/api/v1/notifications/read-state").expect(401);
  });

  it("rejects a user under a role lacking notification:read (403) on both routes", async () => {
    const token = await createPlainAgent();

    await request(app.getHttpServer())
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch("/api/v1/notifications/read-state")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("counts every matching row as unread for a brand-new user (null cursor), then 0 immediately after marking read", async () => {
    const token = await createNotificationReaderAgent("solo");
    const ticketId = await createTicket();
    await emitSlaAtRiskAndWait(ticketId, new Date("2031-01-01T00:00:00.000Z"));

    const before = await getUnreadCount(token);
    expect(before).toBeGreaterThan(0);

    const markReadResponse = await request(app.getHttpServer())
      .patch("/api/v1/notifications/read-state")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(typeof markReadResponse.body.readAt).toBe("string");

    const after = await getUnreadCount(token);
    expect(after).toBe(0);
  });

  it("CRITICAL: one agent marking read never changes a different agent's own unread count, even in the same branch", async () => {
    const tokenA = await createNotificationReaderAgent("agent-a");
    const tokenB = await createNotificationReaderAgent("agent-b");

    const ticketId = await createTicket();
    await emitSlaAtRiskAndWait(ticketId, new Date("2032-01-01T00:00:00.000Z"));

    const beforeA = await getUnreadCount(tokenA);
    const beforeB = await getUnreadCount(tokenB);
    expect(beforeA).toBeGreaterThan(0);
    expect(beforeB).toBeGreaterThan(0);
    expect(beforeA).toBe(beforeB);

    await request(app.getHttpServer())
      .patch("/api/v1/notifications/read-state")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const afterA = await getUnreadCount(tokenA);
    const afterB = await getUnreadCount(tokenB);
    expect(afterA).toBe(0);
    expect(afterB).toBe(beforeB);
  });
});
