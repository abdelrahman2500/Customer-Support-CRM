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
      .send({ title: "How to reset a password", body: "Step-by-step instructions...", category: "account" })
      .expect(201);

    expect(response.body.status).toBe("DRAFT");
    expect(response.body.publishedAt).toBeNull();
    expect(response.body.category).toBe("account");
    articleId = response.body.id;
  });

  it("lists articles in the caller's branch, including the new one", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ids = response.body.map((article: { id: string }) => article.id);
    expect(ids).toContain(articleId);
  });

  // Story 106 — Bounded Result Caps.
  it("never returns more than 200 rows", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.length).toBeLessThanOrEqual(200);
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

  it("updates title/body/category", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "How to reset your password", category: "accounts" })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(after.body.title).toBe("How to reset your password");
    expect(after.body.category).toBe("accounts");
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
      category: "accounts",
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
    expect(byTitle.body.map((article: { id: string }) => article.id)).toContain(articleId);

    const byBody = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .query({ search: "step-by-step" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(byBody.body.map((article: { id: string }) => article.id)).toContain(articleId);

    const noMatch = await request(app.getHttpServer())
      .get("/api/v1/knowledge-base/articles")
      .query({ search: "no-such-article-content-xyz" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(noMatch.body).toEqual([]);
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

      expect(response.body.map((a: { id: string }) => a.id)).toContain(stemFixtureId);
    });

    it("requires every word to match (AND semantics)", async () => {
      const bothWords = await request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query({ search: `${marker} alpha bravo` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(bothWords.body.map((a: { id: string }) => a.id)).toContain(multiWordFixtureId);

      const oneMissingWord = await request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query({ search: `${marker} alpha nonexistentwordxyz` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(oneMissingWord.body.map((a: { id: string }) => a.id)).not.toContain(
        multiWordFixtureId,
      );
    });

    it("orders results by relevance, not always by updatedAt/publishedAt", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/knowledge-base/articles")
        .query({ search: `${marker}zephyrqx` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.map((a: { id: string }) => a.id);
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
});
