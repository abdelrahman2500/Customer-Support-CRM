import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { ChannelMessagesService } from "../src/modules/channels/channel-messages.service";

/**
 * RM-13 — Channel Message Delivery Status & Retry Model. Integration
 * suite for `ChannelMessagesService`'s new delivery-lifecycle methods
 * (`enqueueOutboundDelivery`/`markSent`/`markDelivered`/`markFailed`),
 * mirroring `tasks.e2e-spec.ts`'s ticket/customer fixture setup exactly.
 *
 * No HTTP route calls any of these methods yet — Phase 5's first real
 * adapter will be the first production caller (see the service's own
 * class doc comment) — so this suite resolves `ChannelMessagesService`
 * directly from the compiled `AppModule` (the same DI-resolution
 * approach `ai-processing-producer.e2e-spec.ts` uses for its own
 * producer) and calls its methods directly against the real Postgres
 * database, proving the full row lifecycle end-to-end: create PENDING →
 * SENT → DELIVERED, and separately create PENDING → FAILED.
 */
describe("ChannelMessagesService delivery lifecycle (e2e)", () => {
  let app: INestApplication;
  let channelMessagesService: ChannelMessagesService;
  let ticketId: string;
  let adminUserId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    channelMessagesService = moduleRef.get(ChannelMessagesService);

    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must be set for this suite to run");
    }
    const adminLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    const adminAccessToken = adminLogin.body.accessToken;

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    adminUserId = me.body.id;

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Channel Delivery Fixture Customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "Channel delivery fixture ticket" })
      .expect(201);
    ticketId = ticket.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates every existing Live Chat message DELIVERED by the schema's own default (zero behavior change)", async () => {
    // No sender FK needed — mirrors createSystemMessage's own real Story
    // 85 usage (an AI-authored transcript replay), which is enough here
    // to prove the schema's own DELIVERED default without needing a real
    // Contact fixture this suite has no other reason to create.
    const message = await channelMessagesService.createSystemMessage(
      ticketId,
      "LIVE_CHAT",
      "INBOUND",
      "Hi, I need help",
    );

    expect(message.deliveryStatus).toBe("DELIVERED");
    expect(message.externalMessageId).toBeNull();
    expect(message.retryCount).toBe(0);
  });

  it("takes a message through the full PENDING -> SENT -> DELIVERED lifecycle", async () => {
    const created = await channelMessagesService.enqueueOutboundDelivery(
      ticketId,
      "EMAIL",
      adminUserId,
      "Your invoice is attached.",
    );
    expect(created.deliveryStatus).toBe("PENDING");

    const sent = await channelMessagesService.markSent(created.id, "provider-message-1");
    expect(sent.deliveryStatus).toBe("SENT");
    expect(sent.externalMessageId).toBe("provider-message-1");

    const delivered = await channelMessagesService.markDelivered(created.id);
    expect(delivered.deliveryStatus).toBe("DELIVERED");
    // markSent's externalMessageId persists through the later markDelivered
    // update — that update only ever touches deliveryStatus.
    expect(delivered.externalMessageId).toBe("provider-message-1");
  });

  it("takes a message through PENDING -> FAILED with the given reason and retry count", async () => {
    const created = await channelMessagesService.enqueueOutboundDelivery(
      ticketId,
      "SMS",
      adminUserId,
      "Your appointment is confirmed.",
    );

    const failed = await channelMessagesService.markFailed(
      created.id,
      "Provider rejected: invalid recipient",
      3,
    );

    expect(failed.deliveryStatus).toBe("FAILED");
    expect(failed.failureReason).toBe("Provider rejected: invalid recipient");
    expect(failed.retryCount).toBe(3);
  });
});
