import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCallResult, AiProvider } from "@crm/ai";
import { AiGatewayService } from "./ai-gateway.service";
import type { PrismaService } from "../../prisma/prisma.service";

function buildProviderMock() {
  return {
    summarize: vi.fn(),
    suggestReply: vi.fn(),
    categorize: vi.fn(),
    chat: vi.fn(),
  };
}

function buildPrismaMock() {
  return {
    aiPromptLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

function createService(
  providerMock: ReturnType<typeof buildProviderMock>,
  prismaMock: ReturnType<typeof buildPrismaMock>,
): AiGatewayService {
  return new AiGatewayService(
    providerMock as unknown as AiProvider,
    prismaMock as unknown as PrismaService,
  );
}

const SUCCESS_RESULT: AiCallResult = {
  outcome: "SUCCESS",
  text: "hello",
  model: "claude-test",
  inputTokens: 10,
  outputTokens: 5,
  errorMessage: null,
};

const DISABLED_RESULT: AiCallResult = {
  outcome: "DISABLED",
  text: null,
  model: "disabled",
  inputTokens: null,
  outputTokens: null,
  errorMessage: null,
};

describe("AiGatewayService", () => {
  let provider: ReturnType<typeof buildProviderMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: AiGatewayService;

  beforeEach(() => {
    provider = buildProviderMock();
    prisma = buildPrismaMock();
    service = createService(provider, prisma);
  });

  describe("summarize", () => {
    it("delegates to the provider and logs exactly one SUCCESS AiPromptLog row", async () => {
      provider.summarize.mockResolvedValue(SUCCESS_RESULT);

      const result = await service.summarize({ subject: "s", body: "b" }, "branch-1");

      expect(result).toBe(SUCCESS_RESULT);
      expect(provider.summarize).toHaveBeenCalledWith({ subject: "s", body: "b" });
      expect(prisma.aiPromptLog.create).toHaveBeenCalledOnce();
      const data = prisma.aiPromptLog.create.mock.calls[0]![0].data;
      expect(data).toMatchObject({
        branchId: "branch-1",
        feature: "SUMMARIZE",
        model: "claude-test",
        inputTokens: 10,
        outputTokens: 5,
        outcome: "SUCCESS",
        errorMessage: null,
      });
      expect(typeof data.promptRef).toBe("string");
      expect(data.promptRef.length).toBeGreaterThan(0);
      expect(typeof data.latencyMs).toBe("number");
    });

    it("logs a DISABLED outcome without throwing when the provider is disabled", async () => {
      provider.summarize.mockResolvedValue(DISABLED_RESULT);

      const result = await service.summarize({ subject: "s", body: "b" }, "branch-1");

      expect(result.outcome).toBe("DISABLED");
      expect(prisma.aiPromptLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ outcome: "DISABLED", feature: "SUMMARIZE" }) }),
      );
    });

    it("logs an ERROR outcome and never throws when the provider itself throws", async () => {
      provider.summarize.mockRejectedValue(new Error("boom"));

      const result = await service.summarize({ subject: "s", body: "b" }, "branch-1");

      expect(result.outcome).toBe("ERROR");
      expect(result.errorMessage).toBe("boom");
      expect(prisma.aiPromptLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: "ERROR", errorMessage: "boom" }),
        }),
      );
    });
  });

  describe("suggestReply", () => {
    it("delegates to the provider and logs a SUGGEST_REPLY row", async () => {
      provider.suggestReply.mockResolvedValue(SUCCESS_RESULT);

      await service.suggestReply({ subject: "s", body: "b" }, "branch-1");

      expect(provider.suggestReply).toHaveBeenCalledWith({ subject: "s", body: "b" });
      expect(prisma.aiPromptLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ feature: "SUGGEST_REPLY" }) }),
      );
    });
  });

  describe("categorize", () => {
    it("delegates to the provider and logs a CATEGORIZE row", async () => {
      provider.categorize.mockResolvedValue(SUCCESS_RESULT);

      await service.categorize({ subject: "s", body: "b" }, "branch-1");

      expect(provider.categorize).toHaveBeenCalledWith({ subject: "s", body: "b" });
      expect(prisma.aiPromptLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ feature: "CATEGORIZE" }) }),
      );
    });
  });

  describe("chat", () => {
    it("delegates to the provider and logs a CHAT row", async () => {
      provider.chat.mockResolvedValue(SUCCESS_RESULT);

      await service.chat({ sessionId: "sess-1", message: "hi" }, "branch-1");

      expect(provider.chat).toHaveBeenCalledWith({ sessionId: "sess-1", message: "hi" });
      expect(prisma.aiPromptLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ feature: "CHAT" }) }),
      );
    });

    it("produces the same promptRef for the same session/message and a different one for a different message", async () => {
      provider.chat.mockResolvedValue(SUCCESS_RESULT);

      await service.chat({ sessionId: "sess-1", message: "hi" }, "branch-1");
      const first = prisma.aiPromptLog.create.mock.calls[0]![0].data.promptRef;

      await service.chat({ sessionId: "sess-1", message: "hi" }, "branch-1");
      const second = prisma.aiPromptLog.create.mock.calls[1]![0].data.promptRef;

      await service.chat({ sessionId: "sess-1", message: "bye" }, "branch-1");
      const third = prisma.aiPromptLog.create.mock.calls[2]![0].data.promptRef;

      expect(first).toBe(second);
      expect(first).not.toBe(third);
    });
  });
});
