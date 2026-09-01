import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for `GET /portal/branding` — Story 82 (Branding —
 * Live Logo/Color Consumption).
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, mirroring
 * `portal-tickets.e2e-spec.ts`'s exact fixture/auth pattern. `prisma/
 * seed.ts` creates exactly one Branch, so this suite (like every sibling
 * e2e suite) cannot exercise true cross-branch isolation end-to-end.
 *
 * `BrandingConfig` has no reset/delete endpoint (`PATCH /branding` is an
 * upsert with no way to write a field back to `null`), and
 * `branding.e2e-spec.ts`'s own final test already leaves this shared
 * branch's branding populated with no cleanup — an already-accepted
 * precedent in this codebase. This suite therefore never assumes the
 * branch starts with all-null defaults: it snapshots the agent-facing
 * `GET /branding` first and compares the portal endpoint against that
 * same snapshot, so it passes regardless of run order relative to
 * `branding.e2e-spec.ts` or its own prior runs.
 */
describe("Customer Portal — Branding (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let portalAccessToken: string;

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

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Portal Branding Fixture Customer ${randomUUID()}` })
      .expect(201);
    const customerId = customer.body.id;

    const contactEmail = `portal-branding-contact-${randomUUID()}@example.com`;
    const portalPassword = "a-strong-portal-password";
    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Branding Test Contact", email: contactEmail })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contact.body.id}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);

    const portalLogin = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    portalAccessToken = portalLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/portal/branding").expect(401);
  });

  it("rejects an agent-audience token (401)", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/portal/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(401);
  });

  it("returns the same branding the agent-facing GET /branding shows for this branch", async () => {
    const agentView = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const portalView = await request(app.getHttpServer())
      .get("/api/v1/portal/branding")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);

    expect(portalView.body).toEqual(agentView.body);
  });

  it("reflects a real PATCH /branding (made by an agent) on the next GET /portal/branding", async () => {
    const logoUrl = `https://example.com/logo-${randomUUID()}.png`;
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ logoUrl, primaryColor: "#112233", secondaryColor: "#445566" })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/branding")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      logoUrl,
      primaryColor: "#112233",
      secondaryColor: "#445566",
    });
  });
});
