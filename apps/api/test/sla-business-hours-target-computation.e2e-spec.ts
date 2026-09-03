import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for the calendar-present path of `SlaTargetListener`
 * (Story 13) — proves the real listener reads a real `BusinessHoursCalendar`
 * from the real database and produces business-hours-aware targets through
 * the real HTTP/DB stack. Exhaustive algorithmic correctness (multi-day
 * spans, DST, overnight-boundary handling, etc.) is already covered by
 * `business-hours-calculator.spec.ts`'s pure-function unit tests — this
 * suite only needs to prove the wiring, not re-prove the algorithm.
 *
 * `BusinessHoursCalendar` is a singleton per branch (Story 12) and this
 * suite runs against the same shared, persistent seeded branch every other
 * e2e suite does. `beforeAll` resets the calendar's weekly schedule to a
 * schedule this suite fully controls (all 7 days open 00:00-23:59) via the
 * existing Story 12 `PATCH`/`POST` endpoints, and `afterAll` restores
 * `business-hours-calendars.e2e-spec.ts`'s own baseline (Mon-Fri 09:00-17:00,
 * weekends closed) so a later suite (alphabetically, `sla-targets.e2e-spec.ts`)
 * sees the schedule it expects.
 *
 * Because the real "now" at test-run time is not controllable in a
 * black-box e2e HTTP test, every scenario below is deliberately designed
 * to be correct regardless of what the actual current UTC time happens to
 * be — using exception dates computed relative to the real current date,
 * and response-target durations large enough to *guarantee* the walk
 * crosses the relevant date no matter how much of "today" is already
 * spent — rather than predicting an exact landing instant.
 */
describe("SLA Business-Hours-Aware Target Computation (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let tomorrowDate: string;
  let dayAfterTomorrowDate: string;

  function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  function continuousWeek(): Array<{
    weekday: number;
    isOpen: boolean;
    startMinute?: number;
    endMinute?: number;
  }> {
    return Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isOpen: true,
      startMinute: 0,
      endMinute: 1439,
    }));
  }

  function baselineWeek(): Array<{
    weekday: number;
    isOpen: boolean;
    startMinute?: number;
    endMinute?: number;
  }> {
    return Array.from({ length: 7 }, (_, weekday) => {
      const isWeekend = weekday === 0 || weekday === 6;
      return isWeekend
        ? { weekday, isOpen: false }
        : { weekday, isOpen: true, startMinute: 540, endMinute: 1020 };
    });
  }

  async function resetCalendarStateForCurrentBranch(): Promise<void> {
    // Belt-and-suspenders alongside `afterAll`'s own top-level guard: skip
    // rather than send a request built from an unset `adminAccessToken`
    // (e.g. if this is ever called before `beforeAll` assigns it), which
    // `/auth/me` would (correctly) reject with a confusing, unrelated 401.
    if (!adminAccessToken) {
      return;
    }

    const prisma = app.get(PrismaService);
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const calendar = await prisma.businessHoursCalendar.findFirst({
      where: { branchId: me.body.branchId },
      include: { exceptions: true, days: true },
    });

    if (!calendar) {
      return;
    }

    await prisma.businessHoursException.deleteMany({ where: { calendarId: calendar.id } });
    await prisma.businessHoursDay.deleteMany({ where: { calendarId: calendar.id } });
  }

  async function setWeeklySchedule(
    days: Array<{ weekday: number; isOpen: boolean; startMinute?: number; endMinute?: number }>,
  ): Promise<void> {
    const patchResponse = await request(app.getHttpServer())
      .patch("/api/v1/business-hours-calendars")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ days });
    if (patchResponse.status === 404) {
      // No calendar exists yet (e.g. this suite run in isolation, without
      // business-hours-calendars.e2e-spec.ts having run first) — create one.
      await request(app.getHttpServer())
        .post("/api/v1/business-hours-calendars")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ days })
        .expect(201);
      return;
    }
    expect(patchResponse.status).toBe(200);
  }

  /**
   * Unlike the calendar itself, `BusinessHoursException` isn't a per-branch
   * singleton in general — but this suite always targets the same
   * deterministic offsets from "today" (`tomorrowDate`/`dayAfterTomorrowDate`),
   * so a rerun on the same real calendar day hits the same dates a prior
   * run already created, via the `[calendarId, date]` unique constraint.
   * Tolerates that the same way `business-hours-calendars.e2e-spec.ts`
   * tolerates a rerun of the calendar's own singleton creation: on a 409,
   * find the existing exception for this date and update it to the wanted
   * state instead of creating a new one.
   */
  async function ensureException(
    date: string,
    body: { isClosed?: boolean; overrideStartMinute?: number; overrideEndMinute?: number },
  ): Promise<void> {
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ date, ...body });

    if (createResponse.status === 201) {
      return;
    }
    if (createResponse.status !== 409) {
      throw new Error(`Unexpected exception creation status: ${createResponse.status}`);
    }

    const list = await request(app.getHttpServer())
      .get("/api/v1/business-hours-calendars/exceptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const existing = list.body.find((e: { id: string; date: string }) => e.date === date);
    if (!existing) {
      throw new Error(`Expected an existing exception for ${date} after a 409, found none`);
    }
    await request(app.getHttpServer())
      .patch(`/api/v1/business-hours-calendars/exceptions/${existing.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send(body)
      .expect(200);
  }

  async function createTicketWithPolicy(
    responseTargetMinutes: number,
    resolutionTargetMinutes: number,
  ): Promise<{ id: string; createdAt: Date }> {
    const category = await request(app.getHttpServer())
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `sla-bh-e2e-${randomUUID()}` })
      .expect(201);
    const categoryId = category.body.id;
    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ categoryId, responseTargetMinutes, resolutionTargetMinutes })
      .expect(201);

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `SLA business-hours e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "Business-hours e2e ticket", categoryId })
      .expect(201);
    return {
      id: ticket.body.id as string,
      createdAt: new Date(ticket.body.createdAt),
    };
  }

  async function waitForSlaTarget(
    ticketId: string,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<request.Response> {
    const deadline = Date.now() + timeoutMs;
    let lastResponse: request.Response;
    do {
      lastResponse = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/sla-target`)
        .set("Authorization", `Bearer ${adminAccessToken}`);
      if (lastResponse.status === 200) {
        return lastResponse;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    return lastResponse;
  }

  // Both hooks below get a longer timeout than the project-wide 15s default
  // (`vitest.config.mts`): each does a full Nest app boot plus several
  // chained real HTTP/DB round trips (login, `/auth/me`, calendar reset,
  // weekly-schedule write), which a loaded CI runner can push past 15s.
  // When `beforeAll` doesn't finish — a timeout, or any other failure —
  // before `adminAccessToken` gets assigned, `afterAll` still runs
  // (jest/vitest always run cleanup hooks) and every helper here builds its
  // Authorization header unconditionally from that token, so reusing it
  // unset sends a literal "Bearer undefined" request and fails with a
  // confusing, unrelated 401 that looks like an auth bug. See `afterAll`'s
  // own guard below for the fix.
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

    const now = new Date();
    tomorrowDate = isoDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    dayAfterTomorrowDate = isoDate(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));

    await resetCalendarStateForCurrentBranch();
    await setWeeklySchedule(continuousWeek());
  }, 30_000);

  afterAll(async () => {
    // Guard the whole cleanup body — not just `resetCalendarStateForCurrentBranch`
    // — behind the same "did setup actually get a token" check: every helper
    // here (`setWeeklySchedule` included) builds its Authorization header
    // unconditionally from `adminAccessToken`, so skipping only the first
    // call still let the very next one send a "Bearer undefined" request and
    // fail with the same misleading 401 one line later. And `app.close()`
    // moves into `finally` so a failed cleanup step here can never skip
    // tearing down this suite's Nest app/DB connections, which would
    // otherwise leak into every e2e file that runs after this one.
    try {
      if (adminAccessToken) {
        await resetCalendarStateForCurrentBranch();
        await setWeeklySchedule(baselineWeek());
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  }, 30_000);

  it("computes same-day, business-hours-aware targets under a fully open calendar", async () => {
    // Under this suite's fully open (continuous, 00:00-23:59) calendar, a
    // target only stays on the same UTC calendar day as ticket creation if
    // at least `durationMinutes` remain before UTC midnight (the window's
    // end minute is 1439, matching `continuousWeek()` above); otherwise the
    // walk correctly rolls over to the next day. `todayDate` is captured
    // once in `beforeAll` and can be stale by the time this test actually
    // runs, so — mirroring `business-hours-calculator.ts`'s own arithmetic —
    // compute the expected date from the instant just before ticket
    // creation instead of assuming same-day, keeping this assertion correct
    // no matter what time of day the suite runs, including near UTC
    // midnight.
    const ticket = await createTicketWithPolicy(30, 240);
    function expectedTargetDate(durationMinutes: number): string {
      const minuteOfDay = ticket.createdAt.getUTCHours() * 60 + ticket.createdAt.getUTCMinutes();
      const availableToday = 1439 - minuteOfDay;
      return availableToday >= durationMinutes
        ? isoDate(ticket.createdAt)
        : isoDate(new Date(ticket.createdAt.getTime() + 24 * 60 * 60 * 1000));
    }

    const response = await waitForSlaTarget(ticket.id);
    expect(response.status).toBe(200);

    const responseTargetAt = new Date(response.body.responseTargetAt);
    const resolutionTargetAt = new Date(response.body.resolutionTargetAt);
    expect(resolutionTargetAt.getTime()).toBeGreaterThanOrEqual(responseTargetAt.getTime());
    expect(isoDate(responseTargetAt)).toBe(expectedTargetDate(30));
    expect(isoDate(resolutionTargetAt)).toBe(expectedTargetDate(240));
  });

  it("skips a closed exception date entirely", async () => {
    await ensureException(tomorrowDate, { isClosed: true });

    // Large enough to guarantee crossing past today (at most 1439 open
    // minutes remain) AND past all of tomorrow (now fully closed, 0
    // minutes), landing on a later, still-continuously-open date —
    // regardless of what time "now" actually is.
    const ticket = await createTicketWithPolicy(2000, 2000);
    const response = await waitForSlaTarget(ticket.id);
    expect(response.status).toBe(200);

    expect(isoDate(new Date(response.body.responseTargetAt))).not.toBe(tomorrowDate);
    expect(isoDate(new Date(response.body.resolutionTargetAt))).not.toBe(tomorrowDate);
  });

  it("respects a narrower overridden-hours exception instead of the normal (continuous) window", async () => {
    // A 60-minute override window is far too little to satisfy a
    // 3500-minute target on its own — even combined with all of today's
    // and (still-closed-from-the-previous-test) tomorrow's remaining
    // minutes, the walk must roll past this date too, landing later.
    // A calendar that incorrectly treated this date as fully open (1439
    // minutes, like every other date in this suite's schedule) would often
    // finish exactly on this date instead — this is the behavior the
    // assertion below rules out.
    await ensureException(dayAfterTomorrowDate, {
      isClosed: false,
      overrideStartMinute: 700,
      overrideEndMinute: 760,
    });

    const ticket = await createTicketWithPolicy(3500, 3500);
    const response = await waitForSlaTarget(ticket.id);
    expect(response.status).toBe(200);

    expect(isoDate(new Date(response.body.responseTargetAt))).not.toBe(dayAfterTomorrowDate);
    expect(isoDate(new Date(response.body.resolutionTargetAt))).not.toBe(dayAfterTomorrowDate);
  });
});
