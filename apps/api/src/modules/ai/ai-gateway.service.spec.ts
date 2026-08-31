import { describe, expect, it, vi } from "vitest";
import { AiGatewayService, promptRef } from "./ai-gateway.service";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    aiPromptLog: {
      create: vi.fn(),
    },
  };
}

function createService(prismaMock: ReturnType<typeof buildPrismaMock>): AiGatewayService {
  return new AiGatewayService(prismaMock as unknown as PrismaService);
}

describe("AiGatewayService", () => {
  describe("createPendingLog", () => {
    it("creates a PENDING AiPromptLog row with a pending model placeholder and null latency/token fields", async () => {
      const prisma = buildPrismaMock();
      prisma.aiPromptLog.create.mockResolvedValue({ id: "log-1" });
      const service = createService(prisma);

      const result = await service.createPendingLog(
        "SUMMARIZE",
        "branch-1",
        "ticket-1",
        null,
        "abc123",
      );

      expect(prisma.aiPromptLog.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          ticketId: "ticket-1",
          chatSessionId: null,
          feature: "SUMMARIZE",
          model: "pending",
          promptRef: "abc123",
          inputTokens: null,
          outputTokens: null,
          latencyMs: null,
          outcome: "PENDING",
          errorMessage: null,
        },
      });
      expect(result).toEqual({ id: "log-1" });
    });

    it("passes the feature through unchanged for each ticket-assist operation", async () => {
      const prisma = buildPrismaMock();
      prisma.aiPromptLog.create.mockResolvedValue({ id: "log-2" });
      const service = createService(prisma);

      await service.createPendingLog("SUGGEST_REPLY", "branch-1", "ticket-1", null, "ref");
      await service.createPendingLog("CATEGORIZE", "branch-1", "ticket-1", null, "ref");

      expect(prisma.aiPromptLog.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
        data: expect.objectContaining({ feature: "SUGGEST_REPLY" }),
      }));
      expect(prisma.aiPromptLog.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
        data: expect.objectContaining({ feature: "CATEGORIZE" }),
      }));
    });

    it("writes ticketId: null and the real chatSessionId for a CHAT-shaped call", async () => {
      const prisma = buildPrismaMock();
      prisma.aiPromptLog.create.mockResolvedValue({ id: "log-3" });
      const service = createService(prisma);

      await service.createPendingLog("CHAT", "branch-1", null, "session-1", "ref");

      expect(prisma.aiPromptLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            feature: "CHAT",
            ticketId: null,
            chatSessionId: "session-1",
          }),
        }),
      );
    });
  });
});

describe("promptRef", () => {
  it("produces the same reference for the same parts and a different one for different parts", () => {
    const first = promptRef("subject", "body");
    const second = promptRef("subject", "body");
    const third = promptRef("subject", "different body");

    expect(first).toBe(second);
    expect(first).not.toBe(third);
    expect(first.length).toBeGreaterThan(0);
  });
});
