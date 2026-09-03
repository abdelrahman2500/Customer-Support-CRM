import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for the `portal/knowledge-base/articles/*` HTTP
 * surface — Story 54 (Customer Portal — Knowledge Base Browsing).
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `portal-tickets.e2e-spec.ts` (Story 53). Builds its own Customer/
 * Contact (portal-enabled) fixture and creates a real article via the
 * existing agent-facing `POST /knowledge-base/articles` — never a direct
 * DB write.
 *
 * Known scope limit, same as every sibling e2e suite: `prisma/seed.ts`
 * creates exactly one Branch, so this suite cannot exercise true
 * cross-branch isolation end-to-end for the *article* side — the "draft
 * article invisible" case stands in for the 404-masking guarantee; true
 * cross-branch rejection is covered by
 * `knowledge-base.service.spec.ts`'s mocked tests.
 */
describe("Customer Portal — Knowledge Base (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let portalAccessToken: string;
  let draftArticleId: string;
  let publishedArticleId: string;
  const contactEmail = `portal-kb-contact-${randomUUID()}@example.com`;
  const portalPassword = "a-strong-portal-password-1";

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
      .send({ displayName: `Portal KB Fixture Customer ${randomUUID()}` })
      .expect(201);
    const customerId = customer.body.id;

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal KB Test Contact", email: contactEmail })
      .expect(201);
    const contactId = contact.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);

    const portalLogin = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    portalAccessToken = portalLogin.body.accessToken;

    const draftArticle = await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "Draft-only article", body: "Not yet published." })
      .expect(201);
    draftArticleId = draftArticle.body.id;

    const publishedArticle = await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "How to reset your password", body: "Step-by-step instructions...", category: "account" })
      .expect(201);
    publishedArticleId = publishedArticle.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${publishedArticleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "PUBLISHED" })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects every route without a token", async () => {
    await request(app.getHttpServer()).get("/api/v1/portal/knowledge-base/articles").expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/portal/knowledge-base/articles/${publishedArticleId}`)
      .expect(401);
  });

  it("rejects an agent-audience token (401)", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/portal/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(401);
  });

  it("lists only the published article, never the draft", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/knowledge-base/articles")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);

    const ids = response.body.map((article: { id: string }) => article.id);
    expect(ids).toContain(publishedArticleId);
    expect(ids).not.toContain(draftArticleId);
  });

  it("returns the published article's detail", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/portal/knowledge-base/articles/${publishedArticleId}`)
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: publishedArticleId,
      title: "How to reset your password",
      category: "account",
      status: "PUBLISHED",
    });
  });

  it("returns 404 for the draft article — never confirms it exists", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/portal/knowledge-base/articles/${draftArticleId}`)
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(404);
  });

  it("returns 404 for an unknown article id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/portal/knowledge-base/articles/${randomUUID()}`)
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(404);
  });

  // Story 64 — Article Search.
  it("filters the list by title/body, case-insensitive, via ?search=, and never surfaces a draft", async () => {
    const byTitle = await request(app.getHttpServer())
      .get("/api/v1/portal/knowledge-base/articles")
      .query({ search: "RESET YOUR password" })
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    const byTitleIds = byTitle.body.map((article: { id: string }) => article.id);
    expect(byTitleIds).toContain(publishedArticleId);
    expect(byTitleIds).not.toContain(draftArticleId);

    const byDraftTitle = await request(app.getHttpServer())
      .get("/api/v1/portal/knowledge-base/articles")
      .query({ search: "Draft-only" })
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    expect(byDraftTitle.body).toEqual([]);

    const noMatch = await request(app.getHttpServer())
      .get("/api/v1/portal/knowledge-base/articles")
      .query({ search: "no-such-article-content-xyz" })
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    expect(noMatch.body).toEqual([]);
  });

  // Story 109 — Multi-locale content. A dedicated published article, not
  // `publishedArticleId` above (the very next test unpublishes it).
  describe("locale", () => {
    let localizedArticleId: string;

    beforeAll(async () => {
      const article = await request(app.getHttpServer())
        .post("/api/v1/knowledge-base/articles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ title: "How to contact support", body: "Call us or email us." })
        .expect(201);
      localizedArticleId = article.body.id;
      await request(app.getHttpServer())
        .patch(`/api/v1/knowledge-base/articles/${localizedArticleId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "PUBLISHED" })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/api/v1/knowledge-base/articles/${localizedArticleId}/translations/AR`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ title: "كيفية التواصل مع الدعم", body: "اتصل بنا أو راسلنا عبر البريد الإلكتروني." })
        .expect(200);
    });

    it("returns the AR translation for the single-article endpoint when ?locale=AR is given", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/portal/knowledge-base/articles/${localizedArticleId}`)
        .query({ locale: "AR" })
        .set("Authorization", `Bearer ${portalAccessToken}`)
        .expect(200);

      expect(response.body.title).toBe("كيفية التواصل مع الدعم");
      expect(response.body.body).toBe("اتصل بنا أو راسلنا عبر البريد الإلكتروني.");
    });

    it("returns the base (English) content when no locale is given", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/portal/knowledge-base/articles/${localizedArticleId}`)
        .set("Authorization", `Bearer ${portalAccessToken}`)
        .expect(200);

      expect(response.body.title).toBe("How to contact support");
    });

    it("returns the AR translation in the list endpoint when ?locale=AR is given", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/portal/knowledge-base/articles")
        .query({ locale: "AR" })
        .set("Authorization", `Bearer ${portalAccessToken}`)
        .expect(200);

      const found = response.body.find(
        (article: { id: string }) => article.id === localizedArticleId,
      );
      expect(found).toMatchObject({ title: "كيفية التواصل مع الدعم" });
    });

    it("falls back to the base content for a locale with no translation set", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/portal/knowledge-base/articles/${localizedArticleId}`)
        .query({ locale: "EN" })
        .set("Authorization", `Bearer ${portalAccessToken}`)
        .expect(200);

      expect(response.body.title).toBe("How to contact support");
    });
  });

  it("unpublishing the article makes it disappear from the portal view", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${publishedArticleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "DRAFT" })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/portal/knowledge-base/articles/${publishedArticleId}`)
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(404);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/knowledge-base/articles")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    const ids = response.body.map((article: { id: string }) => article.id);
    expect(ids).not.toContain(publishedArticleId);
  });
});
