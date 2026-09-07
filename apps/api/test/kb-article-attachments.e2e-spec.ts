import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MAX_ATTACHMENT_SIZE_BYTES } from "../src/modules/attachments/attachment-limits";

/**
 * Integration suite for the `knowledge-base/articles/:id/attachments/*`
 * HTTP surface — RM-28 (Knowledge Base Article Attachments). Mirrors
 * `customer-attachments.e2e-spec.ts` (Story 67) exactly, scoped to a
 * Knowledge Base article instead of a `Customer`.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis/MinIO. MinIO
 * must be running (`docker compose up -d minio`) with its bucket already
 * created (`S3StorageService.onModuleInit` creates it if missing).
 *
 * Known scope limit, same as every sibling e2e suite: `prisma/seed.ts`
 * creates exactly one Branch, so this suite cannot exercise true
 * cross-branch isolation end-to-end — the "unknown article id" case stands
 * in for that; true cross-branch rejection is covered by
 * `attachments.service.spec.ts`'s mocked-TenantContext tests.
 */
describe("Knowledge Base Article Attachments (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let articleId: string;
  let attachmentId: string;

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

    const article = await request(app.getHttpServer())
      .post("/api/v1/knowledge-base/articles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: `Attachment fixture article ${randomUUID()}`, body: "Some content." })
      .expect(201);
    articleId = article.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request for every route", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .attach("file", Buffer.from("hi"), "note.txt")
      .expect(401);
  });

  it("lists no attachments for a fresh article", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it("rejects an oversized file with 400, before it reaches S3", async () => {
    const oversized = Buffer.alloc(MAX_ATTACHMENT_SIZE_BYTES + 1);
    await request(app.getHttpServer())
      .post(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("file", oversized, { filename: "too-big.png", contentType: "image/png" })
      .expect(400);
  });

  it("rejects a disallowed MIME type with 400", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("file", Buffer.from("#!/bin/sh\necho hi"), {
        filename: "script.sh",
        contentType: "application/x-sh",
      })
      .expect(400);
  });

  it("returns 404 for an unknown article id on upload/list", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/knowledge-base/articles/${randomUUID()}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("file", Buffer.from("hi"), "note.txt")
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${randomUUID()}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("uploads a real file, lists it back, and downloads the original bytes via the presigned URL", async () => {
    const fileContent = `kb article attachment fixture content ${randomUUID()}`;

    const uploadResponse = await request(app.getHttpServer())
      .post(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("file", Buffer.from(fileContent), {
        filename: "reference.txt",
        contentType: "text/plain",
      })
      .expect(201);

    expect(uploadResponse.body).toMatchObject({
      articleId,
      filename: "reference.txt",
      mimeType: "text/plain",
      size: Buffer.byteLength(fileContent),
    });
    expect(uploadResponse.body.key).toBeUndefined(); // never exposed to the caller.
    attachmentId = uploadResponse.body.id;

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(listResponse.body.map((a: { id: string }) => a.id)).toContain(attachmentId);

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/attachments/${attachmentId}/download`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const presignedUrl = downloadResponse.body.url as string;
    expect(presignedUrl).toContain("http");

    const downloaded = await fetch(presignedUrl);
    expect(downloaded.status).toBe(200);
    const downloadedText = await downloaded.text();
    expect(downloadedText).toBe(fileContent);
  });

  it("returns 404 for an unknown attachment id on download", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/articles/${articleId}/attachments/${randomUUID()}/download`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  // Unlike `customer-attachments.e2e-spec.ts`'s Agent-role test (Story
  // 100's default grant includes both `customer:update`/`customer:read`),
  // the default Agent role deliberately excludes `kb:create`/`kb:update`
  // (seed.ts's own doc comment: "excluding every admin/configuration-only
  // permission... authoring kb/quick-reply content") — only `kb:read` is
  // granted. So an Agent can list/download but not upload.
  it("allows an Agent-role user to list (kb:read) but rejects uploading (403, no kb:update)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-kb-attachments-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent KB Attachments",
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
      .get(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/knowledge-base/articles/${articleId}/attachments`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .attach("file", Buffer.from("hi"), "note.txt")
      .expect(403);
  });
});
