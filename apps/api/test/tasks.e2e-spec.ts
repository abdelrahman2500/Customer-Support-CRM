import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Integration suite for RM-03 — Agent Tasks & Reminders.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, mirroring
 * `tickets.e2e-spec.ts`'s exact shape. Two agent users are created (mirrors
 * the "Test Agent" pattern already established for AI/reporting suites) so
 * every "task is owned by the caller, never another agent" claim is proven
 * against a genuinely different authenticated identity, not just a mocked
 * `TenantContext` — that mocked-level proof already exists in
 * `tasks.service.spec.ts`; this file proves the same claim through the
 * real HTTP + Postgres round trip.
 */
describe("Tasks (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAccessToken: string;
  let agentAAccessToken: string;
  let agentBAccessToken: string;
  let ticketId: string;
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
    prisma = moduleRef.get(PrismaService);

    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must be set for this suite to run");
    }
    const adminLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    adminAccessToken = adminLogin.body.accessToken;

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    async function createAgent(label: string): Promise<string> {
      const agentEmail = `agent-tasks-${label}-${randomUUID()}@example.com`;
      const agentPassword = "agent-test-password-123";
      await request(app.getHttpServer())
        .post("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email: agentEmail,
          password: agentPassword,
          fullName: `Test Agent Tasks ${label}`,
          branchId: me.body.branchId,
          departmentId: me.body.departmentId ?? undefined,
          roleId: agentRole.id,
        })
        .expect(201);
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: agentEmail, password: agentPassword })
        .expect(200);
      return login.body.accessToken as string;
    }

    agentAAccessToken = await createAgent("a");
    agentBAccessToken = await createAgent("b");

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Tasks Fixture Customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, subject: "Tasks fixture ticket" })
      .expect(201);
    ticketId = ticket.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request on every route", async () => {
    await request(app.getHttpServer()).get("/api/v1/tasks").expect(401);
    await request(app.getHttpServer()).post("/api/v1/tasks").send({ title: "x" }).expect(401);
    await request(app.getHttpServer()).patch("/api/v1/tasks/00000000-0000-4000-8000-000000000000").send({}).expect(401);
    await request(app.getHttpServer()).delete("/api/v1/tasks/00000000-0000-4000-8000-000000000000").expect(401);
  });

  it("allows any authenticated agent (no dedicated permission required)", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${agentAAccessToken}`)
      .send({ title: "Any agent can create a task" })
      .expect(201);
  });

  it("rejects an empty title with 400", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${agentAAccessToken}`)
      .send({ title: "" })
      .expect(400);
  });

  it("rejects creation with an unknown ticketId with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${agentAAccessToken}`)
      .send({ title: "Bad ticket ref", ticketId: randomUUID() })
      .expect(404);
  });

  it("rejects creation with an unknown customerId with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${agentAAccessToken}`)
      .send({ title: "Bad customer ref", customerId: randomUUID() })
      .expect(404);
  });

  it("creates a task with a real ticket/customer association and a dueAt", async () => {
    const dueAt = "2030-01-01T12:00:00.000Z";
    const response = await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${agentAAccessToken}`)
      .send({ title: "Follow up on the ticket", ticketId, customerId, priority: "HIGH", dueAt })
      .expect(201);

    expect(response.body).toMatchObject({
      title: "Follow up on the ticket",
      priority: "HIGH",
      ticketId,
      customerId,
      dueAt,
      completedAt: null,
    });
  });

  describe("ownership isolation", () => {
    let agentATaskId: string;

    beforeAll(async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ title: "Agent A's private task" })
        .expect(201);
      agentATaskId = created.body.id;
    });

    it("never appears in another agent's list", async () => {
      const listAsB = await request(app.getHttpServer())
        .get("/api/v1/tasks?pageSize=100")
        .set("Authorization", `Bearer ${agentBAccessToken}`)
        .expect(200);

      expect(listAsB.body.items.map((task: { id: string }) => task.id)).not.toContain(agentATaskId);
    });

    it("appears in the owner's own list", async () => {
      const listAsA = await request(app.getHttpServer())
        .get("/api/v1/tasks?pageSize=100")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .expect(200);

      expect(listAsA.body.items.map((task: { id: string }) => task.id)).toContain(agentATaskId);
    });

    it("returns 404 when another agent tries to update it", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${agentATaskId}`)
        .set("Authorization", `Bearer ${agentBAccessToken}`)
        .send({ title: "Hijacked" })
        .expect(404);
    });

    it("returns 404 when another agent tries to delete it", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${agentATaskId}`)
        .set("Authorization", `Bearer ${agentBAccessToken}`)
        .expect(404);
    });
  });

  describe("update", () => {
    it("marks a task complete and then reopens it", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ title: "Complete me" })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${created.body.id}`)
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ completed: true })
        .expect(200);
      const completed = await prisma.task.findUnique({ where: { id: created.body.id } });
      expect(completed?.completedAt).not.toBeNull();

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${created.body.id}`)
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ completed: false })
        .expect(200);
      const reopened = await prisma.task.findUnique({ where: { id: created.body.id } });
      expect(reopened?.completedAt).toBeNull();
    });

    it("resets reminderSentAt when dueAt changes, so a reminder can fire again for the new date", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ title: "Reminder reset check", dueAt: "2030-01-01T00:00:00.000Z" })
        .expect(201);

      // Simulate the worker having already fired this task's reminder.
      await prisma.task.update({
        where: { id: created.body.id },
        data: { reminderSentAt: new Date() },
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${created.body.id}`)
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ dueAt: "2030-06-01T00:00:00.000Z" })
        .expect(200);

      const updated = await prisma.task.findUnique({ where: { id: created.body.id } });
      expect(updated?.reminderSentAt).toBeNull();
    });

    it("clears ticketId/customerId/dueAt when explicitly set to null", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ title: "Clear associations", ticketId, customerId, dueAt: "2030-01-01T00:00:00.000Z" })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${created.body.id}`)
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ ticketId: null, customerId: null, dueAt: null })
        .expect(200);

      const updated = await prisma.task.findUnique({ where: { id: created.body.id } });
      expect(updated).toMatchObject({ ticketId: null, customerId: null, dueAt: null });
    });

    it("returns 404 for a task that doesn't exist", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${randomUUID()}`)
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ title: "x" })
        .expect(404);
    });
  });

  describe("list filters", () => {
    it("filters by completed:true/false", async () => {
      const open = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ title: "Still open" })
        .expect(201);
      const done = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ title: "Already done" })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${done.body.id}`)
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ completed: true })
        .expect(200);

      const openList = await request(app.getHttpServer())
        .get("/api/v1/tasks?completed=false&pageSize=100")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .expect(200);
      const doneList = await request(app.getHttpServer())
        .get("/api/v1/tasks?completed=true&pageSize=100")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .expect(200);

      const openIds = openList.body.items.map((task: { id: string }) => task.id);
      const doneIds = doneList.body.items.map((task: { id: string }) => task.id);
      expect(openIds).toContain(open.body.id);
      expect(openIds).not.toContain(done.body.id);
      expect(doneIds).toContain(done.body.id);
      expect(doneIds).not.toContain(open.body.id);
    });
  });

  describe("delete", () => {
    it("deletes the caller's own task", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .send({ title: "Delete me" })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${created.body.id}`)
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .expect(200);

      const deleted = await prisma.task.findUnique({ where: { id: created.body.id } });
      expect(deleted).toBeNull();
    });

    it("returns 404 for a task that doesn't exist", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${randomUUID()}`)
        .set("Authorization", `Bearer ${agentAAccessToken}`)
        .expect(404);
    });
  });
});
