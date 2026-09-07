import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookInboundService } from "./webhook-inbound.service";
import { WebhookVerifierRegistry } from "./webhook-verifier";
import type { WebhookVerifier } from "./webhook-verifier";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    webhookInboundLog: {
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  registry: WebhookVerifierRegistry,
): WebhookInboundService {
  return new WebhookInboundService(prismaMock as unknown as PrismaService, registry);
}

const HEADERS = {
  "content-type": "application/json",
  "x-signature": "sha256=abc123",
};

describe("WebhookInboundService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  describe("receive", () => {
    it("logs and rejects with 401 for an unrecognized providerKey — no verifier registered", async () => {
      const service = createService(prisma, new WebhookVerifierRegistry());

      await expect(
        service.receive("unknown-provider", Buffer.from('{"a":1}'), HEADERS),
      ).rejects.toThrow(/No verifier registered/);

      expect(prisma.webhookInboundLog.create).toHaveBeenCalledWith({
        data: {
          providerKey: "unknown-provider",
          verified: false,
          rejectReason: expect.stringContaining("No verifier registered"),
          headers: HEADERS,
          body: '{"a":1}',
        },
      });
    });

    it("logs and rejects with 401 when the registered verifier rejects the signature", async () => {
      const verifier: WebhookVerifier = {
        verify: () => ({ verified: false, rejectReason: "signature mismatch" }),
      };
      const service = createService(prisma, new WebhookVerifierRegistry([["test-provider", verifier]]));

      await expect(
        service.receive("test-provider", Buffer.from("payload"), HEADERS),
      ).rejects.toThrow("signature mismatch");

      expect(prisma.webhookInboundLog.create).toHaveBeenCalledWith({
        data: {
          providerKey: "test-provider",
          verified: false,
          rejectReason: "signature mismatch",
          headers: HEADERS,
          body: "payload",
        },
      });
    });

    it("logs and resolves (no throw) when the registered verifier accepts the signature", async () => {
      const verifier: WebhookVerifier = { verify: () => ({ verified: true }) };
      const service = createService(prisma, new WebhookVerifierRegistry([["test-provider", verifier]]));

      await expect(
        service.receive("test-provider", Buffer.from("payload"), HEADERS),
      ).resolves.toBeUndefined();

      expect(prisma.webhookInboundLog.create).toHaveBeenCalledWith({
        data: {
          providerKey: "test-provider",
          verified: true,
          rejectReason: null,
          headers: HEADERS,
          body: "payload",
        },
      });
    });

    it("drops any header Node reports as undefined before writing the Json column", async () => {
      const verifier: WebhookVerifier = { verify: () => ({ verified: true }) };
      const service = createService(prisma, new WebhookVerifierRegistry([["test-provider", verifier]]));

      await service.receive("test-provider", Buffer.from("payload"), {
        ...HEADERS,
        "x-optional": undefined,
      });

      expect(prisma.webhookInboundLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ headers: HEADERS }) }),
      );
    });

    it("passes the exact raw bytes to the verifier, not a re-parsed/re-serialized body", async () => {
      const verify = vi.fn().mockReturnValue({ verified: true });
      const service = createService(prisma, new WebhookVerifierRegistry([["test-provider", { verify }]]));
      const rawBody = Buffer.from('{"b":  2}'); // deliberately non-canonical JSON spacing

      await service.receive("test-provider", rawBody, HEADERS);

      expect(verify).toHaveBeenCalledWith(rawBody, HEADERS);
    });
  });

  describe("listLogs", () => {
    it("orders by receivedAt descending, with id as a deterministic tiebreaker", async () => {
      const service = createService(prisma, new WebhookVerifierRegistry());

      await service.listLogs();

      expect(prisma.webhookInboundLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ receivedAt: "desc" }, { id: "desc" }] }),
      );
    });
  });
});
