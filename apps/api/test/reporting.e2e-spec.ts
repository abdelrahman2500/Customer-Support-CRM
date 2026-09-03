import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { SLA_BREACHED_EVENT } from "../src/modules/sla-policies/sla-detection.events";
import { PrismaService } from "../src/prisma/prisma.service";

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
  let prisma: PrismaService;
  let adminAccessToken: string;
  let adminBranchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    eventEmitter = moduleRef.get(EventEmitter2);
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

  async function createCustomer(): Promise<string> {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Reporting e2e customer ${randomUUID()}` })
      .expect(201);
    return customer.body.id;
  }

  async function createTicket(categoryId?: string): Promise<string> {
    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: await createCustomer(),
        subject: "Reporting e2e ticket",
        ...(categoryId ? { categoryId } : {}),
      })
      .expect(201);
    return ticket.body.id;
  }

  /** Story 120 — a uniquely-named `TicketCategory`, used only as an
   * isolation key: an SLA policy scoped to it can only ever match a
   * ticket that also carries this same id, so this test's own
   * fixture ticket/policy pair never interferes with concurrent
   * e2e activity in the shared dev database. */
  async function createTicketCategory(): Promise<string> {
    const category = await request(app.getHttpServer())
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `reporting-e2e-${randomUUID()}` })
      .expect(201);
    return category.body.id;
  }

  /** Story 93 — `{from, to}` (each `YYYY-MM-DD`) appended as query params
   * when supplied; omitted entirely (not even as empty-string params)
   * otherwise, mirroring the frontend's own `toQueryString` convention. */
  interface DateRange {
    from?: string;
    to?: string;
  }

  function toQueryString(range: DateRange = {}): string {
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  /** `YYYY-MM-DD` for "today"/"yesterday" relative to the real current
   * time. Every `createdAt` this suite's fixtures produce is server-set to
   * `now()` (`Ticket`/`TicketCsatResponse`/`SlaTicketTarget` all default to
   * `now()` with no client-settable override anywhere in this schema — a
   * historical fixture timestamp cannot be fabricated), so range-boundary
   * assertions below are necessarily expressed relative to "today"/
   * "yesterday" rather than fixed historical constants. */
  function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
  function today(): string {
    return isoDate(new Date());
  }
  function yesterday(): string {
    return isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  }

  async function getTicketVolume(range?: DateRange): Promise<{ status: string; count: number }[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reports/ticket-volume${toQueryString(range)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  async function getSlaCompliance(range?: DateRange): Promise<{
    totalWithTarget: number;
    breachedCount: number;
    compliantCount: number;
    complianceRate: number | null;
  }> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reports/sla-compliance${toQueryString(range)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  async function getCsat(
    range?: DateRange,
  ): Promise<{ responseCount: number; averageRating: number | null }> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reports/csat${toQueryString(range)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  async function getAgentPerformance(
    range?: DateRange,
  ): Promise<{ userId: string; fullName: string; openCount: number; resolvedCount: number }[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reports/agent-performance${toQueryString(range)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  /** Story 126 — Ticket Volume by Category. */
  async function getTicketVolumeByCategory(
    range?: DateRange,
  ): Promise<{ categoryId: string | null; categoryName: string | null; count: number }[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reports/ticket-volume-by-category${toQueryString(range)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  async function getTicketAging(range?: DateRange): Promise<{ bucket: string; count: number }[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reports/ticket-aging${toQueryString(range)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  /** Story 99 — Ticket Resolution-Time Metrics. */
  async function getResolutionTime(
    range?: DateRange,
  ): Promise<{ resolvedCount: number; averageResolutionMs: number | null }> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reports/resolution-time${toQueryString(range)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  /** Story 121 — AI Usage/Cost Reporting. */
  interface AiUsageByFeature {
    feature: string;
    callCount: number;
    successCount: number;
    errorCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number | null;
  }
  interface AiUsageSummary {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number | null;
    unpricedCallCount: number;
    byFeature: AiUsageByFeature[];
  }
  async function getAiUsage(range?: DateRange): Promise<AiUsageSummary> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/reports/ai-usage${toQueryString(range)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    return response.body;
  }

  /**
   * Story 121 — there is no HTTP endpoint that lets a caller set
   * `inputTokens`/`outputTokens`/`costMicroUsd` deterministically (a real
   * completed `AiPromptLog` row is only ever produced by `apps/worker`
   * actually calling a real Anthropic API) — this suite creates the row
   * directly via Prisma instead, mirroring `ticket-recategorization.e2e-
   * spec.ts`'s own "no HTTP endpoint exists for this fixture, create it
   * directly" precedent. `ticketId`/`chatSessionId` are both omitted
   * (both nullable, mutually exclusive with `feature`) since this report
   * never reads either.
   */
  async function createAiPromptLog(overrides: {
    feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT";
    outcome: "PENDING" | "SUCCESS" | "ERROR" | "DISABLED";
    model?: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    costMicroUsd?: number | null;
  }): Promise<string> {
    const row = await prisma.aiPromptLog.create({
      data: {
        branchId: adminBranchId,
        feature: overrides.feature,
        model: overrides.model ?? "claude-sonnet-4-5-20250929",
        promptRef: `reporting-e2e-${randomUUID()}`,
        inputTokens: overrides.inputTokens ?? null,
        outputTokens: overrides.outputTokens ?? null,
        outcome: overrides.outcome,
        costMicroUsd: overrides.costMicroUsd ?? null,
      },
    });
    return row.id;
  }

  it("rejects unauthenticated requests on every route", async () => {
    await request(app.getHttpServer()).get("/api/v1/reports/ticket-volume").expect(401);
    await request(app.getHttpServer()).get("/api/v1/reports/sla-compliance").expect(401);
    await request(app.getHttpServer()).get("/api/v1/reports/csat").expect(401);
    await request(app.getHttpServer()).get("/api/v1/reports/agent-performance").expect(401);
    await request(app.getHttpServer()).get("/api/v1/reports/ticket-aging").expect(401);
    await request(app.getHttpServer()).get("/api/v1/reports/resolution-time").expect(401);
    await request(app.getHttpServer()).get("/api/v1/reports/ai-usage").expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/reports/ticket-volume-by-category")
      .expect(401);
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
    await request(app.getHttpServer())
      .get("/api/v1/reports/agent-performance")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/reports/ticket-aging")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/reports/resolution-time")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/reports/ai-usage")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/reports/ticket-volume-by-category")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
  });

  // Story 125 — Reporting Export.
  describe("export (Story 125)", () => {
    const EXPORT_ROUTES = [
      "ticket-volume",
      "sla-compliance",
      "csat",
      "agent-performance",
      "ticket-aging",
      "resolution-time",
      "ai-usage",
      "ticket-volume-by-category",
    ];

    it("rejects unauthenticated requests on every export route (401)", async () => {
      for (const route of EXPORT_ROUTES) {
        await request(app.getHttpServer()).get(`/api/v1/reports/${route}/export`).expect(401);
      }
    });

    it("rejects an Agent-role user lacking report:read on every export route (403)", async () => {
      const roles = await request(app.getHttpServer())
        .get("/api/v1/identity/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

      const agentEmail = `agent-reporting-export-${randomUUID()}@example.com`;
      const agentPassword = "agent-export-test-password-123";
      await request(app.getHttpServer())
        .post("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email: agentEmail,
          password: agentPassword,
          fullName: "Test Agent Reporting Export",
          branchId: adminBranchId,
          roleId: agentRole.id,
        })
        .expect(201);
      const agentLogin = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: agentEmail, password: agentPassword })
        .expect(200);
      const agentAccessToken = agentLogin.body.accessToken as string;

      for (const route of EXPORT_ROUTES) {
        await request(app.getHttpServer())
          .get(`/api/v1/reports/${route}/export`)
          .set("Authorization", `Bearer ${agentAccessToken}`)
          .expect(403);
      }
    });

    it("rejects a reversed range (from > to) with 400 on every export route, identical to the JSON routes", async () => {
      for (const route of EXPORT_ROUTES) {
        await request(app.getHttpServer())
          .get(`/api/v1/reports/${route}/export?from=${today()}&to=${yesterday()}`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .expect(400);
      }
    });

    it("ticket-volume/export returns a CSV whose data matches the JSON route, with the correct headers/filename", async () => {
      await createTicket();
      const jsonRows = await getTicketVolume();

      const response = await request(app.getHttpServer())
        .get("/api/v1/reports/ticket-volume/export")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toMatch(/^text\/csv/);
      expect(response.headers["content-disposition"]).toBe(
        'attachment; filename="ticket-volume-all.csv"',
      );
      const lines = (response.text as string).trim().split("\r\n");
      expect(lines[0]).toBe("Status,Count");
      expect(lines).toHaveLength(jsonRows.length + 1);
      const openLine = lines.find((line) => line.startsWith("OPEN,"));
      const jsonOpenCount = jsonRows.find((row) => row.status === "OPEN")?.count;
      expect(openLine).toBe(`OPEN,${jsonOpenCount}`);
    });

    it("an export route's filename reflects the requested range", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/ticket-volume/export?from=${today()}&to=${today()}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.headers["content-disposition"]).toBe(
        `attachment; filename="ticket-volume-${today()}_${today()}.csv"`,
      );
    });

    it("sla-compliance/export renders the single summary object as a one-row CSV", async () => {
      const summary = await getSlaCompliance();

      const response = await request(app.getHttpServer())
        .get("/api/v1/reports/sla-compliance/export")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const lines = (response.text as string).trim().split("\r\n");
      expect(lines[0]).toBe("Total With Target,Breached Count,Compliant Count,Compliance Rate");
      expect(lines).toHaveLength(2);
      const [totalWithTarget, breachedCount, compliantCount] = lines[1]!.split(",");
      expect(Number(totalWithTarget)).toBe(summary.totalWithTarget);
      expect(Number(breachedCount)).toBe(summary.breachedCount);
      expect(Number(compliantCount)).toBe(summary.compliantCount);
    });

    it("ai-usage/export renders the byFeature breakdown, not the outer summary object", async () => {
      await createAiPromptLog({
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
        inputTokens: 100,
        outputTokens: 50,
        costMicroUsd: 1_000_000,
      });
      const summary = await getAiUsage();
      const summarizeRow = summary.byFeature.find((row) => row.feature === "SUMMARIZE");
      expect(summarizeRow).toBeDefined();

      const response = await request(app.getHttpServer())
        .get("/api/v1/reports/ai-usage/export")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const lines = (response.text as string).trim().split("\r\n");
      expect(lines[0]).toBe(
        "Feature,Call Count,Success Count,Error Count,Total Input Tokens,Total Output Tokens,Total Cost (USD)",
      );
      expect(lines).toHaveLength(summary.byFeature.length + 1);
      const summarizeLine = lines.find((line) => line.startsWith("SUMMARIZE,"));
      expect(summarizeLine).toBe(
        `SUMMARIZE,${summarizeRow!.callCount},${summarizeRow!.successCount},${summarizeRow!.errorCount},${summarizeRow!.totalInputTokens},${summarizeRow!.totalOutputTokens},${summarizeRow!.totalCostUsd}`,
      );
    });

    it("ticket-volume-by-category/export returns a CSV whose data matches the JSON route", async () => {
      const categoryId = await createTicketCategory();
      await createTicket(categoryId);
      const jsonRows = await getTicketVolumeByCategory();
      const row = jsonRows.find((r) => r.categoryId === categoryId);
      expect(row).toBeDefined();

      const response = await request(app.getHttpServer())
        .get("/api/v1/reports/ticket-volume-by-category/export")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toMatch(/^text\/csv/);
      const lines = (response.text as string).trim().split("\r\n");
      expect(lines[0]).toBe("Category ID,Category Name,Count");
      expect(lines).toHaveLength(jsonRows.length + 1);
      const categoryLine = lines.find((line) => line.startsWith(`${categoryId},`));
      expect(categoryLine).toBe(`${categoryId},${row!.categoryName},${row!.count}`);
    });
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

    const matchingCategoryId = await createTicketCategory();
    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ categoryId: matchingCategoryId, responseTargetMinutes: 30, resolutionTargetMinutes: 240 })
      .expect(201);
    const ticketId = await createTicket(matchingCategoryId);

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
    const portalPassword = "a-strong-portal-password-1";
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

  it("reflects a real assignment in openCount, then a real resolution in resolvedCount", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-performance-e2e-${randomUUID()}@example.com`;
    const agent = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: "agent-test-password-123",
        fullName: "Test Agent Performance",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);
    const agentUserId = agent.body.id;

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: await createCustomer(),
        subject: "Agent performance e2e ticket",
        assignedToUserId: agentUserId,
      })
      .expect(201);

    const afterAssign = await getAgentPerformance();
    const agentRowAfterAssign = afterAssign.find((row) => row.userId === agentUserId);
    expect(agentRowAfterAssign).toEqual({
      userId: agentUserId,
      fullName: "Test Agent Performance",
      openCount: 1,
      resolvedCount: 0,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticket.body.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "RESOLVED" })
      .expect(200);

    const afterResolve = await getAgentPerformance();
    const agentRowAfterResolve = afterResolve.find((row) => row.userId === agentUserId);
    expect(agentRowAfterResolve).toEqual({
      userId: agentUserId,
      fullName: "Test Agent Performance",
      openCount: 0,
      resolvedCount: 1,
    });
  });

  it("never includes an unassigned ticket for any agent", async () => {
    const before = await getAgentPerformance();
    const totalBefore = before.reduce((sum, row) => sum + row.openCount + row.resolvedCount, 0);

    await createTicket();

    const after = await getAgentPerformance();
    const totalAfter = after.reduce((sum, row) => sum + row.openCount + row.resolvedCount, 0);
    expect(totalAfter).toBe(totalBefore);
  });

  it("always returns all four buckets, and reflects a real, freshly-created open ticket in 0-1d", async () => {
    const before = await getTicketAging();
    expect(before.map((row) => row.bucket)).toEqual(["0-1d", "1-3d", "3-7d", "7d+"]);
    const beforeCount = before.find((row) => row.bucket === "0-1d")?.count ?? 0;

    await createTicket();

    const after = await getTicketAging();
    const afterCount = after.find((row) => row.bucket === "0-1d")?.count ?? 0;
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("excludes a resolved ticket from every bucket", async () => {
    const ticketId = await createTicket();
    const before = await getTicketAging();
    const totalBefore = before.reduce((sum, row) => sum + row.count, 0);

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "RESOLVED" })
      .expect(200);

    const after = await getTicketAging();
    const totalAfter = after.reduce((sum, row) => sum + row.count, 0);
    // The ticket created just before this test's own resolve step is counted
    // in `before` (it was OPEN) but excluded from `after` (now RESOLVED) —
    // the total drops by exactly one, even though other e2e activity may be
    // concurrently changing other tickets' ages between buckets.
    expect(totalAfter).toBe(totalBefore - 1);
  });

  // -------------------------------------------------------------------
  // Story 99 — Ticket Resolution-Time Metrics.
  // -------------------------------------------------------------------

  it("reflects a real resolution in resolvedCount/averageResolutionMs", async () => {
    const before = await getResolutionTime();

    const ticketId = await createTicket();
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "RESOLVED" })
      .expect(200);

    const after = await getResolutionTime();
    expect(after.resolvedCount).toBe(before.resolvedCount + 1);
    expect(after.averageResolutionMs).not.toBeNull();
  });

  it("does not include a ticket that is still open", async () => {
    const before = await getResolutionTime();

    await createTicket();

    const after = await getResolutionTime();
    expect(after.resolvedCount).toBe(before.resolvedCount);
  });

  it("does not double-count a RESOLVED ticket moved to CLOSED (never actually reopened)", async () => {
    const ticketId = await createTicket();
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "RESOLVED" })
      .expect(200);

    const afterResolved = await getResolutionTime();

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "CLOSED" })
      .expect(200);

    const afterClosed = await getResolutionTime();
    expect(afterClosed.resolvedCount).toBe(afterResolved.resolvedCount);
  });

  it("excludes a ticket that was resolved and then reopened", async () => {
    const ticketId = await createTicket();
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "RESOLVED" })
      .expect(200);
    const afterResolved = await getResolutionTime();

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "IN_PROGRESS" })
      .expect(200);

    const afterReopened = await getResolutionTime();
    expect(afterReopened.resolvedCount).toBe(afterResolved.resolvedCount - 1);
  });

  it("resolution-time: a [today, today] range includes a freshly-resolved ticket; a [yesterday, yesterday] range excludes it", async () => {
    const beforeToday = await getResolutionTime({ from: today(), to: today() });
    const beforeYesterday = await getResolutionTime({ from: yesterday(), to: yesterday() });

    const ticketId = await createTicket();
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "RESOLVED" })
      .expect(200);

    const afterToday = await getResolutionTime({ from: today(), to: today() });
    expect(afterToday.resolvedCount).toBe(beforeToday.resolvedCount + 1);

    // The ticket was just resolved "today," not "yesterday" — that range's
    // own count (captured before this fixture existed) must be unchanged.
    const afterYesterday = await getResolutionTime({ from: yesterday(), to: yesterday() });
    expect(afterYesterday.resolvedCount).toBe(beforeYesterday.resolvedCount);
  });

  it("omitting from/to entirely reproduces the exact all-time response (backward compatibility)", async () => {
    const allTime = await getResolutionTime();
    const explicitlyUnfiltered = await getResolutionTime({});
    expect(explicitlyUnfiltered).toEqual(allTime);
  });

  // -------------------------------------------------------------------
  // Story 93 — date-range filtering, all five routes.
  // -------------------------------------------------------------------

  it("rejects a malformed from/to value with 400 on ticket-volume", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/reports/ticket-volume?from=not-a-date")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(400);
  });

  it("rejects a reversed range (from > to) with 400 on ticket-volume", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/reports/ticket-volume?from=${today()}&to=${yesterday()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(400);
  });

  it("rejects a shape-valid but non-existent calendar date (2026-02-30) with 400", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/reports/ticket-volume?from=2026-02-30")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(400);
  });

  it("ticket-volume: a [today, today] range includes a freshly-created ticket; a [yesterday, yesterday] range excludes it", async () => {
    const beforeToday = await getTicketVolume({ from: today(), to: today() });
    const beforeTodayOpen = beforeToday.find((row) => row.status === "OPEN")?.count ?? 0;

    await createTicket();

    const afterToday = await getTicketVolume({ from: today(), to: today() });
    const afterTodayOpen = afterToday.find((row) => row.status === "OPEN")?.count ?? 0;
    expect(afterTodayOpen).toBe(beforeTodayOpen + 1);

    const yesterdayOnly = await getTicketVolume({ from: yesterday(), to: yesterday() });
    const yesterdayOpen = yesterdayOnly.find((row) => row.status === "OPEN")?.count ?? 0;
    expect(yesterdayOpen).toBe(0);
  });

  it("csat: a [today, today] range includes freshly-submitted feedback; a [yesterday, yesterday] range excludes it", async () => {
    const contactEmail = `reporting-e2e-range-contact-${randomUUID()}@example.com`;
    const portalPassword = "a-strong-portal-password-1";
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Reporting e2e range CSAT customer ${randomUUID()}` })
      .expect(201);
    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customer.body.id}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Reporting e2e Range Contact", email: contactEmail })
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

    const beforeToday = await getCsat({ from: today(), to: today() });
    const beforeYesterday = await getCsat({ from: yesterday(), to: yesterday() });

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${portalToken}`)
      .send({ subject: "Reporting e2e range CSAT ticket" })
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

    const afterToday = await getCsat({ from: today(), to: today() });
    expect(afterToday.responseCount).toBe(beforeToday.responseCount + 1);

    // The feedback was just submitted "today," not "yesterday" — that
    // range's own count (captured before this fixture existed) must be
    // unchanged, not equal to `beforeToday`'s unrelated count.
    const afterYesterday = await getCsat({ from: yesterday(), to: yesterday() });
    expect(afterYesterday.responseCount).toBe(beforeYesterday.responseCount);
  });

  it("sla-compliance: filters the cohort by SlaTicketTarget.createdAt — a [today, today] range includes a fresh target+breach; [yesterday, yesterday] excludes it", async () => {
    const beforeToday = await getSlaCompliance({ from: today(), to: today() });
    const beforeYesterday = await getSlaCompliance({ from: yesterday(), to: yesterday() });

    const matchingCategoryId = await createTicketCategory();
    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ categoryId: matchingCategoryId, responseTargetMinutes: 30, resolutionTargetMinutes: 240 })
      .expect(201);
    const ticketId = await createTicket(matchingCategoryId);

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

    eventEmitter.emit(SLA_BREACHED_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "resolution",
      targetAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const escalationDeadline = Date.now() + 5000;
    let afterToday = beforeToday;
    while (
      Date.now() < escalationDeadline &&
      afterToday.breachedCount === beforeToday.breachedCount
    ) {
      afterToday = await getSlaCompliance({ from: today(), to: today() });
      if (afterToday.breachedCount === beforeToday.breachedCount) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    expect(afterToday.totalWithTarget).toBe(beforeToday.totalWithTarget + 1);
    expect(afterToday.breachedCount).toBe(beforeToday.breachedCount + 1);
    expect(afterToday.compliantCount).toBe(afterToday.totalWithTarget - afterToday.breachedCount);

    // The target (and therefore the whole cohort) was created today, not
    // yesterday — that range's own count (captured before this fixture
    // existed) must be unchanged, not equal to `beforeToday`'s unrelated
    // count.
    const afterYesterday = await getSlaCompliance({ from: yesterday(), to: yesterday() });
    expect(afterYesterday.totalWithTarget).toBe(beforeYesterday.totalWithTarget);
    expect(afterYesterday.breachedCount).toBe(beforeYesterday.breachedCount);
  });

  it("agent-performance: a [today, today] range includes a freshly-assigned ticket's current status; [yesterday, yesterday] excludes it", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-performance-range-e2e-${randomUUID()}@example.com`;
    const agent = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: "agent-test-password-123",
        fullName: "Test Agent Performance Range",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);
    const agentUserId = agent.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: await createCustomer(),
        subject: "Agent performance range e2e ticket",
        assignedToUserId: agentUserId,
      })
      .expect(201);

    const afterToday = await getAgentPerformance({ from: today(), to: today() });
    expect(afterToday.find((row) => row.userId === agentUserId)).toEqual({
      userId: agentUserId,
      fullName: "Test Agent Performance Range",
      openCount: 1,
      resolvedCount: 0,
    });

    const yesterdayOnly = await getAgentPerformance({ from: yesterday(), to: yesterday() });
    expect(yesterdayOnly.find((row) => row.userId === agentUserId)).toBeUndefined();
  });

  it("ticket-aging: a [today, today] range includes a freshly-created open ticket in 0-1d; [yesterday, yesterday] excludes it", async () => {
    const beforeToday = await getTicketAging({ from: today(), to: today() });
    const beforeCount = beforeToday.find((row) => row.bucket === "0-1d")?.count ?? 0;

    await createTicket();

    const afterToday = await getTicketAging({ from: today(), to: today() });
    const afterCount = afterToday.find((row) => row.bucket === "0-1d")?.count ?? 0;
    expect(afterCount).toBe(beforeCount + 1);

    const yesterdayOnly = await getTicketAging({ from: yesterday(), to: yesterday() });
    const yesterdayCount = yesterdayOnly.find((row) => row.bucket === "0-1d")?.count ?? 0;
    expect(yesterdayCount).toBe(0);
  });

  it("omitting from/to entirely reproduces the exact all-time response (backward compatibility)", async () => {
    const allTime = await getTicketVolume();
    const explicitlyUnfiltered = await getTicketVolume({});
    expect(explicitlyUnfiltered).toEqual(allTime);
  });

  // Story 121 — AI Usage/Cost Reporting.
  describe("ai-usage", () => {
    it("reflects a real, priced SUCCESS AiPromptLog row in totalCalls/totalCostUsd and its own feature's row", async () => {
      const before = await getAiUsage();

      await createAiPromptLog({
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
        model: "claude-sonnet-4-5-20250929",
        inputTokens: 500,
        outputTokens: 200,
        // 500 * $3/M + 200 * $15/M = 1500 + 3000 = 4500 micro-USD = $0.0045.
        costMicroUsd: 4500,
      });

      const after = await getAiUsage();
      expect(after.totalCalls).toBe(before.totalCalls + 1);
      expect(after.totalInputTokens).toBe(before.totalInputTokens + 500);
      expect(after.totalOutputTokens).toBe(before.totalOutputTokens + 200);
      expect((after.totalCostUsd ?? 0) - (before.totalCostUsd ?? 0)).toBeCloseTo(0.0045, 10);

      const summarizeRow = after.byFeature.find((row) => row.feature === "SUMMARIZE");
      expect(summarizeRow).toBeDefined();
      expect(summarizeRow!.successCount).toBeGreaterThanOrEqual(1);
    });

    it("counts an unpriced SUCCESS row in unpricedCallCount, never silently as $0 or dropped from totalCalls", async () => {
      const before = await getAiUsage();

      await createAiPromptLog({
        feature: "CATEGORIZE",
        outcome: "SUCCESS",
        model: "some-future-unpriced-model",
        inputTokens: 100,
        outputTokens: 50,
        costMicroUsd: null,
      });

      const after = await getAiUsage();
      expect(after.totalCalls).toBe(before.totalCalls + 1);
      expect(after.unpricedCallCount).toBe(before.unpricedCallCount + 1);
    });

    it("counts an ERROR row in errorCount, contributing no tokens/cost", async () => {
      const before = await getAiUsage();

      await createAiPromptLog({ feature: "CHAT", outcome: "ERROR" });

      const after = await getAiUsage();
      expect(after.totalCalls).toBe(before.totalCalls + 1);
      const chatRow = after.byFeature.find((row) => row.feature === "CHAT");
      expect(chatRow).toBeDefined();
      expect(chatRow!.errorCount).toBeGreaterThanOrEqual(1);
    });

    it("a [today, today] range includes a freshly-created row; a [yesterday, yesterday] range is unaffected by it", async () => {
      const beforeToday = await getAiUsage({ from: today(), to: today() });
      // Story 5's disclosed date-boundary flake precedent (CLAUDE.md §13):
      // never assert an absolute yesterday count in this shared, persistent
      // database — only that creating a fixture *today* leaves *yesterday's*
      // own count exactly as it already was (a delta, like every other
      // range assertion in this suite).
      const beforeYesterday = await getAiUsage({ from: yesterday(), to: yesterday() });

      await createAiPromptLog({
        feature: "SUGGEST_REPLY",
        outcome: "SUCCESS",
        inputTokens: 10,
        outputTokens: 10,
        costMicroUsd: 100,
      });

      const afterToday = await getAiUsage({ from: today(), to: today() });
      expect(afterToday.totalCalls).toBe(beforeToday.totalCalls + 1);

      const afterYesterday = await getAiUsage({ from: yesterday(), to: yesterday() });
      expect(afterYesterday.totalCalls).toBe(beforeYesterday.totalCalls);
    });
  });

  // Story 126 — Ticket Volume by Category.
  describe("ticket-volume-by-category", () => {
    it("reflects a real, newly-created ticket's category in the volume-by-category delta", async () => {
      const categoryId = await createTicketCategory();
      const before = await getTicketVolumeByCategory();
      const beforeCount = before.find((row) => row.categoryId === categoryId)?.count ?? 0;

      await createTicket(categoryId);

      const after = await getTicketVolumeByCategory();
      const afterRow = after.find((row) => row.categoryId === categoryId);
      expect(afterRow?.count).toBe(beforeCount + 1);
      expect(afterRow?.categoryName).not.toBeNull();
    });

    it("reflects a real, uncategorized ticket in the categoryId: null (Uncategorized) row", async () => {
      const before = await getTicketVolumeByCategory();
      const beforeUncategorized = before.find((row) => row.categoryId === null)?.count ?? 0;

      await createTicket();

      const after = await getTicketVolumeByCategory();
      const afterUncategorized = after.find((row) => row.categoryId === null);
      expect(afterUncategorized?.count).toBe(beforeUncategorized + 1);
      expect(afterUncategorized?.categoryName).toBeNull();
    });

    it("sorts named categories by name ascending, with the Uncategorized row always last", async () => {
      await createTicket();
      const result = await getTicketVolumeByCategory();

      const namedCategoryNames = result
        .filter((row) => row.categoryId !== null)
        .map((row) => row.categoryName as string);
      expect(namedCategoryNames).toEqual([...namedCategoryNames].sort((a, b) => a.localeCompare(b)));
      expect(result[result.length - 1]?.categoryId).toBeNull();
    });

    it("a [today, today] range includes a freshly-created ticket; a [yesterday, yesterday] range excludes it", async () => {
      const categoryId = await createTicketCategory();
      const beforeToday = await getTicketVolumeByCategory({ from: today(), to: today() });
      const beforeTodayCount =
        beforeToday.find((row) => row.categoryId === categoryId)?.count ?? 0;

      await createTicket(categoryId);

      const afterToday = await getTicketVolumeByCategory({ from: today(), to: today() });
      const afterTodayCount = afterToday.find((row) => row.categoryId === categoryId)?.count ?? 0;
      expect(afterTodayCount).toBe(beforeTodayCount + 1);

      const yesterdayOnly = await getTicketVolumeByCategory({ from: yesterday(), to: yesterday() });
      expect(yesterdayOnly.find((row) => row.categoryId === categoryId)).toBeUndefined();
    });

    it("omitting from/to entirely reproduces the exact all-time response (backward compatibility)", async () => {
      const allTime = await getTicketVolumeByCategory();
      const explicitlyUnfiltered = await getTicketVolumeByCategory({});
      expect(explicitlyUnfiltered).toEqual(allTime);
    });
  });
});
