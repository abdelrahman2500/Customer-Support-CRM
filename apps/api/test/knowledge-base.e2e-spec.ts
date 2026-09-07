import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for the `knowledge-base/articles/*` HTTP surface —
 * Story 51 (Knowledge Base Foundation).
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `sla-policies.e2e-spec.ts`/`tickets.e2e-spec.ts`. Requires
 * `DATABASE_URL`/`REDIS_URL` pointed at a real, migrated, and SEEDED
 * database (re-seeded with the `kb:*` permissions this story adds).
 *
 * Known scope limit, same as every sibling e2e suite: `prisma/seed.ts`
 * creates exactly one Branch, so this suite cannot exercise true
 * cross-branch isolation end-to-end — the "unknown article id" case stands
 * in for that; true cross-branch rejection is covered by
 * `knowledge-base.service.spec.ts`'s mocked-TenantContext tests.
 */
describe("Knowledge Base (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let articleId: string;
  // RM-27 — `category` (free text) replaced by `categoryId`; every article
  // fixture below that needs a category first creates one via `POST
  // /kb-categories`, uniquely-named per run so this suite's own fixtures
  // never collide with concurrent e2e activity in the shared dev database.
  let accountCategoryId: string;
  let accountCategoryName: string;
  let accountsCategoryId: string;
  let accountsCategoryName: string;

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

    accountCategoryName = `account-${randomUUID()}`;
    const accountCategory = await request(app.getHttpServer())
      .post("/api/v1/kb-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: accountCategoryName })
      .expect(201);
    accountCategoryId = accountCategory.body.id;

    accountsCategoryName = `accounts-${randomUUID()}`;
    const accountsCategory = await request(app.getHttpServer())
      .post("/api/v1/kb-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: accountsCategoryName })
      .expect(201);
    accountsCategoryId = accountsCategory.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request for every route", async () => {
    await request(app.getHttpServer()).get("/api/v1/knowledge-base/articles").expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .send({ title: "t", body: "b" })
      .expect(401);
  });

  it("rejects an empty title/body with a validation error", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "", body: "Some body" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "Some title", body: "" })
      .expect(400);
  });

  it("creates a DRAFT article", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        title: "How to reset a password",
        body: "Step-by-step instructions...",
        categoryId: accountCategoryId,
      })
      .expect(201);

    expect(response.body.status).toBe("DRAFT");
    expect(response.body.publishedAt).toBeNull();
    expect(response.body.categoryId).toBe(accountCategoryId);
    expect(response.body.categoryName).toBe(accountCategoryName);
    articleId = response.body.id;
  });

  it("rejects an unknown categoryId with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "Bad category", body: "...", categoryId: randomUUID() })
      .expect(404);
  });

  it("lists articles in the caller's branch, including the new one", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    // Story S-8c — the list returns a paginated envelope.
    const ids = response.body.items.map((article: { id: string }) => article.id);
    expect(ids).toContain(articleId);
  });

  // Story 106 — Bounded Result Caps.
  it("never returns more than 200 rows", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.items.length).toBeLessThanOrEqual(response.body.pageSize);
    expect(response.body.total).toBeGreaterThanOrEqual(response.body.items.length);
  });

  it("gets a single article", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.id).toBe(articleId);
  });

  it("returns 404 for an unknown article id on get/update", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "Should not apply" })
      .expect(404);
  });

  it("rejects an invalid status value with a validation error", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "NOT_A_REAL_STATUS" })
      .expect(400);
  });

  it("updates title/body/categoryId", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "How to reset your password", categoryId: accountsCategoryId })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(after.body.title).toBe("How to reset your password");
    expect(after.body.categoryId).toBe(accountsCategoryId);
    expect(after.body.categoryName).toBe(accountsCategoryName);
  });

  it("rejects an unknown categoryId on update with 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ categoryId: randomUUID() })
      .expect(404);
  });

  it("publishes the article, stamping publishedAt", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "PUBLISHED" })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(after.body.status).toBe("PUBLISHED");
    expect(after.body.publishedAt).not.toBeNull();
  });

  it("unpublishes the article, leaving publishedAt set to its last value", async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "DRAFT" })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(after.body.status).toBe("DRAFT");
    expect(after.body.publishedAt).toBe(before.body.publishedAt);
  });

  // Story 65 — Article Version History.
  it("created a version 1 snapshot the first time it was published", async () => {
    const versions = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/versions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(versions.body).toHaveLength(1);
    expect(versions.body[0]).toMatchObject({
      articleId,
      versionNumber: 1,
      title: "How to reset your password",
      category: accountsCategoryName,
    });
    expect(versions.body[0].publishedAt).not.toBeNull();
  });

  it("creates a further, correctly-sequenced version on a re-publish after an edit; a plain edit or unpublish creates none", async () => {
    // Currently DRAFT (left there by the "unpublishes" test above).
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ body: "Revised, more detailed step-by-step instructions..." })
      .expect(200);

    const afterPlainEdit = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/versions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterPlainEdit.body).toHaveLength(1); // still just version 1 — no new version yet.

    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "PUBLISHED" })
      .expect(200);

    const afterRepublish = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/versions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterRepublish.body).toHaveLength(2);
    const [latest, original] = afterRepublish.body;
    expect(latest).toMatchObject({
      versionNumber: 2,
      body: "Revised, more detailed step-by-step instructions...",
    });
    expect(original).toMatchObject({ versionNumber: 1 });

    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "DRAFT" })
      .expect(200);

    const afterUnpublish = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/versions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterUnpublish.body).toHaveLength(2); // unchanged — unpublishing creates no version.
  });

  it("returns [] for an article that has never been published", async () => {
    const neverPublished = await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "Never published", body: "Draft content only." })
      .expect(201);

    const versions = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${neverPublished.body.id}/versions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(versions.body).toEqual([]);
  });

  it("returns 404 for an unknown article id's versions", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${randomUUID()}/versions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  // Story 64 — Article Search.
  it("filters the list by title/body, case-insensitive, via ?search=", async () => {
    const byTitle = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .query({ search: "RESET YOUR password" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(byTitle.body.items.map((article: { id: string }) => article.id)).toContain(articleId);

    const byBody = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .query({ search: "step-by-step" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(byBody.body.items.map((article: { id: string }) => article.id)).toContain(articleId);

    const noMatch = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .query({ search: "no-such-article-content-xyz" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(noMatch.body.items).toEqual([]);
  });

  // Story 102 — Full-Text Search. Dedicated fixture articles (not the
  // shared `articleId` above) so these don't interfere with, or depend
  // on, the plain search test's own assertions.
  describe("full-text search (Story 102)", () => {
    let stemFixtureId: string;
    let multiWordFixtureId: string;
    let highRelevanceId: string;
    let lowRelevanceId: string;
    const marker = randomUUID().replace(/-/g, "");

    beforeAll(async () => {
      const stemFixture = await request(app.getHttpServer())
        .post("/api/v1/knowledge-base/articles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          title: `${marker} Connecting to the office VPN`,
          body: "Instructions for joining the corporate network.",
        })
        .expect(201);
      stemFixtureId = stemFixture.body.id;

      const multiWordFixture = await request(app.getHttpServer())
        .post("/api/v1/knowledge-base/articles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          title: `${marker} Alpha Bravo widget setup`,
          body: "Covers alpha and bravo configuration together.",
        })
        .expect(201);
      multiWordFixtureId = multiWordFixture.body.id;

      // Relevance: the search term appears in the title (a short,
      // concentrated match) and repeatedly in the body of one article,
      // and only once inside a much longer, unrelated body of the other —
      // `ts_rank` weights title matches and match density higher, so the
      // first should rank above the second when both match the same term.
      const searchTerm = `${marker}zephyrqx`;
      const highRelevance = await request(app.getHttpServer())
        .post("/api/v1/knowledge-base/articles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          title: `${searchTerm} overview`,
          body: `${searchTerm} is our main topic here, and this article is all about ${searchTerm}.`,
        })
        .expect(201);
      highRelevanceId = highRelevance.body.id;

      const lowRelevance = await request(app.getHttpServer())
        .post("/api/v1/knowledge-base/articles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          title: "Unrelated maintenance notes",
          body: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Somewhere in this long paragraph there is a single passing mention of ${searchTerm} and nothing more.`,
        })
        .expect(201);
      lowRelevanceId = lowRelevance.body.id;
    });

    it("matches a different inflection of the same word (stemming)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query({ search: `${marker} connect` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.map((a: { id: string }) => a.id)).toContain(stemFixtureId);
    });

    it("requires every word to match (AND semantics)", async () => {
      const bothWords = await request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query({ search: `${marker} alpha bravo` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(bothWords.body.items.map((a: { id: string }) => a.id)).toContain(multiWordFixtureId);

      const oneMissingWord = await request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query({ search: `${marker} alpha nonexistentwordxyz` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(oneMissingWord.body.items.map((a: { id: string }) => a.id)).not.toContain(
        multiWordFixtureId,
      );
    });

    it("orders results by relevance, not always by updatedAt/publishedAt", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query({ search: `${marker}zephyrqx` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.items.map((a: { id: string }) => a.id);
      expect(ids).toEqual([highRelevanceId, lowRelevanceId]);
    });
  });

  // Story 109 — Multi-locale content. A dedicated fixture article, not
  // the shared `articleId` above (which other tests in this file mutate
  // through publish/unpublish/edit cycles) — translations are tested in
  // isolation against their own, otherwise-untouched article.
  describe("translations", () => {
    let translatedArticleId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/knowledge-base/articles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ title: "How to reset a password", body: "Step-by-step instructions..." })
        .expect(201);
      translatedArticleId = response.body.id;
    });

    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/knowledge-base/articles/${translatedArticleId}/translations/AR`)
        .send({ title: "عنوان", body: "نص" })
        .expect(401);
      await request(app.getHttpServer())
        .get(`/api/v1/knowledge-base/articles/${translatedArticleId}/translations`)
        .expect(401);
    });

    it("rejects an invalid :locale segment with 400", async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/knowledge-base/articles/${translatedArticleId}/translations/FR`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ title: "Titre", body: "Texte" })
        .expect(400);
    });

    it("returns 404 for an unknown article id", async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/knowledge-base/articles/${randomUUID()}/translations/AR`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ title: "عنوان", body: "نص" })
        .expect(404);
    });

    it("returns [] for an article with no translations set yet", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/knowledge-base/articles/${translatedArticleId}/translations`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("sets an AR translation, then lists it back", async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/knowledge-base/articles/${translatedArticleId}/translations/AR`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ title: "كيفية إعادة تعيين كلمة المرور", body: "تعليمات خطوة بخطوة..." })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/knowledge-base/articles/${translatedArticleId}/translations`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toEqual([
        expect.objectContaining({
          articleId: translatedArticleId,
          locale: "AR",
          title: "كيفية إعادة تعيين كلمة المرور",
          body: "تعليمات خطوة بخطوة...",
        }),
      ]);
    });

    it("resolves the AR translation via GET .../articles/:id?locale=AR", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/knowledge-base/articles/${translatedArticleId}`)
        .query({ locale: "AR" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.title).toBe("كيفية إعادة تعيين كلمة المرور");
      expect(response.body.body).toBe("تعليمات خطوة بخطوة...");
    });

    it("falls back to the base (English) content when no locale is given", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/knowledge-base/articles/${translatedArticleId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.title).toBe("How to reset a password");
    });

    it("re-setting the same locale replaces the translation wholesale (upsert), not merge", async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/knowledge-base/articles/${translatedArticleId}/translations/AR`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ title: "عنوان محدّث", body: "نص محدّث" })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/knowledge-base/articles/${translatedArticleId}/translations`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toEqual([
        expect.objectContaining({ locale: "AR", title: "عنوان محدّث", body: "نص محدّث" }),
      ]);
    });
  });

  // Story 100 — Agent's default seed grant now includes `kb:read`
  // (previously `[]`), so the two read routes below are now reachable;
  // only the write routes (`kb:create`/`kb:update`, still not granted)
  // remain 403.
  it("allows reading (kb:read) but still rejects creating or updating articles (403) for an Agent-role user (Story 100)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-kb-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent KB",
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
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ title: "Should not be created", body: "..." })
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ title: "Should not apply" })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/versions`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
  });

  /**
   * Story S-8c — paging `GET /knowledge-base/articles`.
   *
   * The article library is shared across this suite's own fixtures and
   * whatever has accumulated, so every assertion is relative to the
   * endpoint's own reported `total` rather than a fixed row count.
   */
  describe("pagination (Story S-8c)", () => {
    function get(query: Record<string, unknown> = {}) {
      return request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query(query)
        .set("Authorization", `Bearer ${adminAccessToken}`);
    }

    it("defaults to page 1 at a page size of 25", async () => {
      const response = await get().expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(25);
      expect(response.body.items.length).toBeLessThanOrEqual(25);
      expect(response.body.totalPages).toBe(Math.max(1, Math.ceil(response.body.total / 25)));
    });

    it("echoes back an explicit page and pageSize", async () => {
      const response = await get({ page: 2, pageSize: 5 }).expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.pageSize).toBe(5);
      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });

    it("returns a non-overlapping second page", async () => {
      const first = await get({ page: 1, pageSize: 1 }).expect(200);
      if (first.body.total <= 1) {
        expect(first.body.totalPages).toBe(1);
        return;
      }

      const second = await get({ page: 2, pageSize: 1 }).expect(200);
      const firstIds = first.body.items.map((a: { id: string }) => a.id);
      const secondIds = second.body.items.map((a: { id: string }) => a.id);
      for (const id of secondIds) {
        expect(firstIds).not.toContain(id);
      }
    });

    it("returns the last page with at least one row", async () => {
      const first = await get({ pageSize: 2 }).expect(200);
      const last = await get({ page: first.body.totalPages, pageSize: 2 }).expect(200);

      expect(last.body.page).toBe(first.body.totalPages);
      expect(last.body.items.length).toBeGreaterThan(0);
    });

    it("returns 200 with an empty page past the end, keeping the metadata accurate", async () => {
      const first = await get({ pageSize: 5 }).expect(200);
      const beyond = await get({ page: first.body.totalPages + 50, pageSize: 5 }).expect(200);

      expect(beyond.body.items).toEqual([]);
      expect(beyond.body.page).toBe(first.body.totalPages + 50);
      expect(beyond.body.total).toBe(first.body.total);
      expect(beyond.body.totalPages).toBe(first.body.totalPages);
    });

    it("does not repeat a row across pages", async () => {
      const size = 3;
      const pages = await Promise.all([
        get({ page: 1, pageSize: size }).expect(200),
        get({ page: 2, pageSize: size }).expect(200),
      ]);

      const ids = pages.flatMap((p) => p.body.items.map((a: { id: string }) => a.id));
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("pages a full-text search, counting only the matches", async () => {
      const all = await get({ pageSize: 1 }).expect(200);
      const searched = await get({ search: "password", pageSize: 1 }).expect(200);

      expect(searched.body.total).toBeLessThanOrEqual(all.body.total);
      expect(searched.body.items.length).toBeLessThanOrEqual(1);
      expect(searched.body.totalPages).toBe(Math.max(1, Math.ceil(searched.body.total / 1)));
    });

    it("keeps the locale resolution working on a paged response", async () => {
      const response = await get({ pageSize: 5, locale: "AR" }).expect(200);

      expect(response.body.pageSize).toBe(5);
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it("returns an accurate empty envelope for a search that matches nothing", async () => {
      const response = await get({ search: `no-such-article-${randomUUID()}` }).expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBe(0);
      expect(response.body.totalPages).toBe(1);
      expect(response.body.page).toBe(1);
    });

    it("accepts the maximum page size", async () => {
      const response = await get({ pageSize: 100 }).expect(200);

      expect(response.body.pageSize).toBe(100);
    });

    it("rejects an invalid page or pageSize with 400", async () => {
      await get({ pageSize: 101 }).expect(400);
      await get({ pageSize: 0 }).expect(400);
      await get({ pageSize: "abc" }).expect(400);
      await get({ page: 0 }).expect(400);
      await get({ page: -1 }).expect(400);
      await get({ page: "abc" }).expect(400);
    });

    it("still requires authentication on a paginated request", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query({ page: 2 })
        .expect(401);
    });
  });
});
