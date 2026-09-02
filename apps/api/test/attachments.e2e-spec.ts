import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MAX_ATTACHMENT_SIZE_BYTES } from "../src/modules/attachments/attachment-limits";

/**
 * Integration suite for the `tickets/:id/attachments/*` HTTP surface —
 * Story 66 (Ticket Attachments Foundation).
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis/MinIO,
 * exactly like every sibling e2e suite does for Postgres/Redis — MinIO
 * must be running (`docker compose up -d minio`) with its bucket already
 * created (this module's own `S3StorageService.onModuleInit` creates it
 * if missing).
 *
 * Known scope limit, same as every sibling e2e suite: `prisma/seed.ts`
 * creates exactly one Branch, so this suite cannot exercise true
 * cross-branch isolation end-to-end — the "unknown ticket id" case stands
 * in for that; true cross-branch rejection is covered by
 * `attachments.service.spec.ts`'s mocked-TenantContext tests.
 */
describe("Ticket Attachments (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let ticketId: string;
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

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Attachment Fixture Customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "Attachment fixture ticket" })
      .expect(201);
    ticketId = ticket.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request for every route", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/attachments`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/attachments`)
      .attach("file", Buffer.from("hi"), "note.txt")
      .expect(401);
  });

  it("lists no attachments for a fresh ticket", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it("rejects an oversized file with 400, before it reaches S3", async () => {
    const oversized = Buffer.alloc(MAX_ATTACHMENT_SIZE_BYTES + 1);
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("file", oversized, { filename: "too-big.png", contentType: "image/png" })
      .expect(400);
  });

  it("rejects a disallowed MIME type with 400", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("file", Buffer.from("#!/bin/sh\necho hi"), {
        filename: "script.sh",
        contentType: "application/x-sh",
      })
      .expect(400);
  });

  it("returns 404 for an unknown ticket id on upload/list", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${randomUUID()}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("file", Buffer.from("hi"), "note.txt")
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${randomUUID()}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("uploads a real file, lists it back, and downloads the original bytes via the presigned URL", async () => {
    const fileContent = `fixture content ${randomUUID()}`;

    const uploadResponse = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .attach("file", Buffer.from(fileContent), { filename: "notes.txt", contentType: "text/plain" })
      .expect(201);

    expect(uploadResponse.body).toMatchObject({
      ticketId,
      filename: "notes.txt",
      mimeType: "text/plain",
      size: Buffer.byteLength(fileContent),
    });
    expect(uploadResponse.body.key).toBeUndefined(); // never exposed to the caller.
    attachmentId = uploadResponse.body.id;

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(listResponse.body.map((a: { id: string }) => a.id)).toContain(attachmentId);

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/attachments/${attachmentId}/download`)
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
      .get(`/api/v1/tickets/${ticketId}/attachments/${randomUUID()}/download`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  // Story 100 — Agent's default seed grant now includes `ticket:update`
  // and `ticket:read` (previously `[]`), so both routes below are now
  // reachable by a freshly seeded Agent-role user; this proves that,
  // rather than a 403.
  it("allows an Agent-role user with the default ticket:update/ticket:read grant (Story 100)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-attachments-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Attachments",
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
      .post(`/api/v1/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .attach("file", Buffer.from("hi"), "note.txt")
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
  });
});
