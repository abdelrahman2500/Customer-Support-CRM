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
      .send({
        title: "How to reset your password",
        body: "Step-by-step instructions...",
        category: "account",
      })
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

    // Story S-8c — the list returns a paginated envelope.
    const ids = response.body.items.map((article: { id: string }) => article.id);
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
    const byTitleIds = byTitle.body.items.map((article: { id: string }) => article.id);
    expect(byTitleIds).toContain(publishedArticleId);
    expect(byTitleIds).not.toContain(draftArticleId);

    const byDraftTitle = await request(app.getHttpServer())
      .get("/api/v1/portal/knowledge-base/articles")
      .query({ search: "Draft-only" })
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    expect(byDraftTitle.body.items).toEqual([]);

    const noMatch = await request(app.getHttpServer())
      .get("/api/v1/portal/knowledge-base/articles")
      .query({ search: "no-such-article-content-xyz" })
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    expect(noMatch.body.items).toEqual([]);
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
        .send({
          title: "كيفية التواصل مع الدعم",
          body: "اتصل بنا أو راسلنا عبر البريد الإلكتروني.",
        })
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

      const found = response.body.items.find(
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
    // Story S-8c — the list returns a paginated envelope.
    const ids = response.body.items.map((article: { id: string }) => article.id);
    expect(ids).not.toContain(publishedArticleId);
  });

  /**
   * Story S-8c — paging `GET /portal/knowledge-base/articles`.
   *
   * The isolation that matters here is `status: PUBLISHED`: a portal reader
   * must not learn a draft exists, and `total` is as capable of disclosing
   * that as `items` is.
   */
  describe("pagination (Story S-8c)", () => {
    function get(query: Record<string, unknown> = {}) {
      return request(app.getHttpServer())
        .get("/api/v1/portal/knowledge-base/articles")
        .query(query)
        .set("Authorization", `Bearer ${portalAccessToken}`);
    }

    it("defaults to page 1 at a page size of 25", async () => {
      const response = await get().expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(25);
      expect(response.body.totalPages).toBe(Math.max(1, Math.ceil(response.body.total / 25)));
    });

    it("never counts a draft in the total", async () => {
      const response = await get({ pageSize: 100 }).expect(200);

      // Every returned row is published...
      for (const article of response.body.items) {
        expect(article.status).toBe("PUBLISHED");
      }
      // ...and the total agrees, rather than counting the drafts the
      // fixtures created alongside them.
      expect(response.body.total).toBe(response.body.items.length);
    });

    it("returns 200 with an empty page past the end", async () => {
      const first = await get({ pageSize: 1 }).expect(200);
      const beyond = await get({ page: first.body.totalPages + 20, pageSize: 1 }).expect(200);

      expect(beyond.body.items).toEqual([]);
      expect(beyond.body.total).toBe(first.body.total);
    });

    it("pages a search without surfacing a draft", async () => {
      const response = await get({ search: "support", pageSize: 5 }).expect(200);

      for (const article of response.body.items) {
        expect(article.status).toBe("PUBLISHED");
      }
      expect(response.body.pageSize).toBe(5);
    });

    it("keeps locale resolution working on a paged response", async () => {
      const response = await get({ locale: "AR", pageSize: 5 }).expect(200);

      expect(response.body.pageSize).toBe(5);
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it("rejects an invalid page or pageSize with 400", async () => {
      await get({ pageSize: 101 }).expect(400);
      await get({ pageSize: 0 }).expect(400);
      await get({ page: 0 }).expect(400);
      await get({ page: "abc" }).expect(400);
    });

    it("still requires a portal session on a paginated request", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/portal/knowledge-base/articles")
        .query({ page: 2 })
        .expect(401);
    });
  });
});
