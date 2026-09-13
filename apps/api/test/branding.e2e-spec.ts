import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Integration suite for Story 62 — `GET/PATCH /branding`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like every other e2e suite here. Branch-scoped (like
 * `audit-logs-read.e2e-spec.ts`), mirrors `automation-rules.e2e-spec.ts`'s
 * exact 401/403 boilerplate.
 *
 * Config + admin-form preview only (Story 62's own scope) — no assertion
 * here ever checks a rendered logo/color anywhere outside this API surface,
 * matching the story's explicit non-goal of live, shared-layout
 * consumption.
 *
 * Story 129 — `appName`/`navigationLayout` join the same surface. This
 * suite now clears the seeded branch's `BrandingConfig` row in
 * `beforeAll` (`PATCH /branding` is an upsert with no way to write a
 * field back to `null`, so there is no API route to the same state).
 * That makes "an unconfigured branch returns nulls" — the single most
 * important guarantee of this story, since it is what every existing
 * branch gets on upgrade — assertable deterministically, and makes the
 * whole file idempotent when re-run against a persistent dev database
 * rather than only after `test:e2e`'s own `migrate reset`.
 */
describe("Branding (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAccessToken: string;
  let branchId: string;

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

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    branchId = me.body.branchId;

    prisma = app.get(PrismaService);
    await prisma.brandingConfig.deleteMany({ where: { branchId } });
  });

  afterAll(async () => {
    await app.close();
  });

  // Story 129 — the backward-compatibility guarantee, asserted before this
  // suite patches anything: an unconfigured branch (which is every branch
  // that existed before this story) reads back all-null, and the frontend
  // resolves that to the pre-Story-129 navbar and the translated default
  // app name.
  it("returns null for every field, the two new ones included, before any PATCH", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      appName: null,
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      navigationLayout: null,
    });
  });

  it("rejects an unauthenticated request on every route", async () => {
    await request(app.getHttpServer()).get("/api/v1/branding").expect(401);
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .send({ primaryColor: "#112233" })
      .expect(401);
  });

  it("rejects an Agent-role user lacking branding:read/update on every route (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-branding-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: "agent-test-password-123",
        fullName: "Test Agent Branding",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);
    const agentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: "agent-test-password-123" })
      .expect(200);
    const agentAccessToken = agentLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ primaryColor: "#112233" })
      .expect(403);
  });

  it("rejects an invalid hex color with a validation error", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ primaryColor: "not-a-color" })
      .expect(400);
  });

  it("rejects an invalid logoUrl with a validation error", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ logoUrl: "not-a-url" })
      .expect(400);
  });

  it("persists a real PATCH, reflected on the next GET, and leaves other fields untouched on a partial update", async () => {
    const logoUrl = `https://example.com/logo-${randomUUID()}.png`;
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ logoUrl, primaryColor: "#112233", secondaryColor: "#445566" })
      .expect(200);

    const afterFirstUpdate = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterFirstUpdate.body).toEqual({
      appName: null,
      logoUrl,
      primaryColor: "#112233",
      secondaryColor: "#445566",
      navigationLayout: null,
    });

    // A partial update (secondaryColor only) must leave logoUrl/primaryColor
    // exactly as they were.
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ secondaryColor: "#778899" })
      .expect(200);

    const afterPartialUpdate = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterPartialUpdate.body).toEqual({
      appName: null,
      logoUrl,
      primaryColor: "#112233",
      secondaryColor: "#778899",
      navigationLayout: null,
    });
  });

  // Story 129 — Admin Branding & Navigation Layout Customization.
  it("persists appName and navigationLayout, reflected on the next GET", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ appName: "Acme Support", navigationLayout: "SIDEBAR" })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.appName).toBe("Acme Support");
    expect(response.body.navigationLayout).toBe("SIDEBAR");
  });

  it("leaves the other four fields untouched when only one new field is patched", async () => {
    const logoUrl = `https://example.com/logo-${randomUUID()}.png`;
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        appName: "Acme Support",
        logoUrl,
        primaryColor: "#112233",
        secondaryColor: "#445566",
        navigationLayout: "SIDEBAR",
      })
      .expect(200);

    // Patch ONLY navigationLayout — the other four must survive verbatim.
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ navigationLayout: "NAVBAR" })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      appName: "Acme Support",
      logoUrl,
      primaryColor: "#112233",
      secondaryColor: "#445566",
      navigationLayout: "NAVBAR",
    });

    // And the mirror case: patching only appName must not reset the layout.
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ appName: "Renamed Support" })
      .expect(200);

    const afterAppNameOnly = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(afterAppNameOnly.body).toEqual({
      appName: "Renamed Support",
      logoUrl,
      primaryColor: "#112233",
      secondaryColor: "#445566",
      navigationLayout: "NAVBAR",
    });
  });

  // `@IsEnum` rejects it before the service ever sees it. The frontend can
  // only ever send one of the two radio values, so this guards the API
  // against everything else.
  it("rejects an unknown navigationLayout with a validation error", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ navigationLayout: "TOPBAR" })
      .expect(400);
  });

  it("rejects a lowercase navigationLayout with a validation error", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ navigationLayout: "sidebar" })
      .expect(400);
  });

  // `@MaxLength(60)` is a layout guarantee: the name renders inside a
  // fixed-width sidebar rail and a single-line navbar.
  it("rejects a 61-character appName with a validation error", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ appName: "a".repeat(61) })
      .expect(400);
  });

  it("accepts an appName of exactly 60 characters", async () => {
    const appName = "a".repeat(60);
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ appName })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.appName).toBe(appName);
  });

  // Free text in both locales — there is no character class to enforce, so
  // an Arabic name with an emoji must round-trip untouched.
  it("stores an Arabic appName verbatim", async () => {
    const appName = "دعم أكمي 🚀";
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ appName })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.appName).toBe(appName);
  });
});
