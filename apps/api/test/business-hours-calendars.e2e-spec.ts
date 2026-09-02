import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for `business-hours-calendars/*`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `sla-policies.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL`
 * pointed at a real, migrated, and SEEDED database.
 *
 * `BusinessHoursCalendar` is a true singleton per branch (`branchId` is
 * `@unique`) — unlike every other e2e-tested resource, it cannot be
 * re-created fresh on every run against this shared, persistent, never-
 * reset database (there is only ever one seeded branch). `beforeAll`
 * therefore tolerates a 409 from a prior run and resets the existing
 * calendar to the known fixture schedule via PATCH instead, so every test
 * below runs against a deterministic baseline regardless of history —
 * mirroring the same idempotent-by-design reasoning `prisma/seed.ts` uses
 * for its own singleton rows. Exceptions are NOT singletons, so each test
 * that creates one uses a freshly-randomized date to avoid any collision
 * with a prior run (per Story 12's "avoid fixture collisions" instruction).
 *
 * Known scope limit, same as every other suite in this codebase: `seed.ts`
 * creates exactly one Branch, so true cross-branch isolation cannot be
 * exercised end-to-end here — it is covered by
 * `business-hours-calendars.service.spec.ts`'s mocked-`TenantContext` tests.
 */
describe("Business-Hours Calendars (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;

  function weekdaySchedule(mondayOverride?: { startMinute: number; endMinute: number }) {
    return Array.from({ length: 7 }, (_, weekday) => {
      const isWeekend = weekday === 0 || weekday === 6;
      if (isWeekend) {
        return { weekday, isOpen: false };
      }
      if (weekday === 1 && mondayOverride) {
        return { weekday, isOpen: true, ...mondayOverride };
      }
      return { weekday, isOpen: true, startMinute: 540, endMinute: 1020 };
    });
  }

  function randomFutureDate(): string {
    const base = new Date("2027-01-01T00:00:00.000Z");
    const offsetDays = Math.floor(Math.random() * 3650);
    return new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

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

    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ days: weekdaySchedule() });

    if (createResponse.status === 409) {
      // A calendar for this branch already exists from a prior run against
      // this persistent database — reset it to the known fixture schedule.
      await request(app.getHttpServer())
        .patch("/api/v1/business-hours-calendars")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ days: weekdaySchedule() })
        .expect(200);
    } else if (createResponse.status !== 201) {
      throw new Error(`Unexpected calendar creation status: ${createResponse.status}`);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/business-hours-calendars").expect(401);
  });

  it("gets the calendar with sla:read, with the fixture weekly schedule", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.days).toHaveLength(7);
    const monday = response.body.days.find((d: { weekday: number }) => d.weekday === 1);
    expect(monday).toMatchObject({ isOpen: true, startMinute: 540, endMinute: 1020 });
    const sunday = response.body.days.find((d: { weekday: number }) => d.weekday === 0);
    expect(sunday).toMatchObject({ isOpen: false, startMinute: null, endMinute: null });
  });

  it("updates the weekly schedule with sla:update and persists the change", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ days: weekdaySchedule({ startMinute: 600, endMinute: 1080 }) })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const monday = after.body.days.find((d: { weekday: number }) => d.weekday === 1);
    expect(monday).toMatchObject({ startMinute: 600, endMinute: 1080 });

    // Restore the baseline fixture so later tests (and later runs) see the
    // documented 09:00-17:00 schedule again.
    await request(app.getHttpServer())
      .patch("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ days: weekdaySchedule() })
      .expect(200);
  });

  it("rejects a duplicate calendar for the same branch", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ days: weekdaySchedule() })
      .expect(409);
  });

  it("rejects an invalid weekly schedule (missing weekday entries)", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ days: weekdaySchedule().slice(0, 6) })
      .expect(400);
  });

  it("creates a closure exception and returns it via the list endpoint", async () => {
    const date = randomFutureDate();
    const created = await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ date })
      .expect(201);

    expect(created.body).toMatchObject({ date, isClosed: true, overrideStartMinute: null, overrideEndMinute: null });

    const list = await request(app.getHttpServer())
      .get("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(list.body.some((e: { id: string }) => e.id === created.body.id)).toBe(true);
  });

  it("creates an overridden-hours exception", async () => {
    const date = randomFutureDate();
    const created = await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ date, isClosed: false, overrideStartMinute: 600, overrideEndMinute: 720 })
      .expect(201);

    expect(created.body).toMatchObject({
      date,
      isClosed: false,
      overrideStartMinute: 600,
      overrideEndMinute: 720,
    });
  });

  it("rejects an override exception missing override minutes", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ date: randomFutureDate(), isClosed: false })
      .expect(400);
  });

  it("rejects a duplicate exception date", async () => {
    const date = randomFutureDate();
    await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ date })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ date })
      .expect(409);
  });

  it("updates an exception from closed to overridden hours", async () => {
    const date = randomFutureDate();
    const created = await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ date })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/business-hours-calendars/exceptions/${created.body.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isClosed: false, overrideStartMinute: 480, overrideEndMinute: 600 })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const updated = list.body.find((e: { id: string }) => e.id === created.body.id);
    expect(updated).toMatchObject({ isClosed: false, overrideStartMinute: 480, overrideEndMinute: 600 });
  });

  it("returns 404 for updating an unknown exception id", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/business-hours-calendars/exceptions/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isClosed: true })
      .expect(404);
  });

  // Story 100 — Agent's default seed grant now includes `sla:read`
  // (previously `[]`), so the GET route below is now reachable; only the
  // write routes (`sla:create`/`sla:update`, still not granted) remain 403.
  it("allows reading (sla:read) but still rejects writing the calendar (403) for an Agent-role user (Story 100)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-bhc-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Business Hours",
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
      .get("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ days: weekdaySchedule() })
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ date: randomFutureDate() })
      .expect(403);
  });
});
