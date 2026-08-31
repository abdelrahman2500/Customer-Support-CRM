import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCallResult, AiProvider } from "@crm/ai";
import { AiProcessingProcessor } from "./ai-processing.processor";
import type { AiProcessingJobPayload } from "./ai-processing.processor";
import type { PrismaService } from "../prisma/prisma.service";
import type { Job, Queue } from "bullmq";

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
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function buildHandbackQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProcessor(
  providerMock: ReturnType<typeof buildProviderMock>,
  prismaMock: ReturnType<typeof buildPrismaMock>,
  handbackMock: ReturnType<typeof buildHandbackQueueMock>,
): AiProcessingProcessor {
  return new AiProcessingProcessor(
    providerMock as unknown as AiProvider,
    prismaMock as unknown as PrismaService,
    handbackMock as unknown as Queue,
  );
}

function buildJob(data: AiProcessingJobPayload): Job<AiProcessingJobPayload> {
  return { data } as Job<AiProcessingJobPayload>;
}

const SUCCESS_RESULT: AiCallResult = {
  outcome: "SUCCESS",
  text: "A summary.",
  model: "claude-test",
  inputTokens: 10,
  outputTokens: 5,
  errorMessage: null,
};

const PAYLOAD: AiProcessingJobPayload = {
  aiPromptLogId: "log-1",
  ticketId: "ticket-1",
  branchId: "branch-1",
  feature: "SUMMARIZE",
  subject: "Login issue",
  body: "Checked logs.",
};

describe("AiProcessingProcessor", () => {
  let provider: ReturnType<typeof buildProviderMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let handbackQueue: ReturnType<typeof buildHandbackQueueMock>;
  let processor: AiProcessingProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = buildProviderMock();
    prisma = buildPrismaMock();
    handbackQueue = buildHandbackQueueMock();
    processor = createProcessor(provider, prisma, handbackQueue);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("process", () => {
    it("calls provider.summarize for a SUMMARIZE job, updates the log row, and hands back SUCCESS", async () => {
      provider.summarize.mockResolvedValue(SUCCESS_RESULT);
      const job = buildJob(PAYLOAD);

      await processor.process(job);

      expect(provider.summarize).toHaveBeenCalledWith({ subject: "Login issue", body: "Checked logs." });
      expect(provider.suggestReply).not.toHaveBeenCalled();
      expect(provider.categorize).not.toHaveBeenCalled();
      expect(prisma.aiPromptLog.update).toHaveBeenCalledWith({
        where: { id: "log-1" },
        data: {
          model: "claude-test",
          inputTokens: 10,
          outputTokens: 5,
          latencyMs: expect.any(Number),
          outcome: "SUCCESS",
          outputText: "A summary.",
          errorMessage: null,
        },
      });
      expect(handbackQueue.add).toHaveBeenCalledWith("ai-completion", {
        aiPromptLogId: "log-1",
        ticketId: "ticket-1",
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
      });
    });

    it("calls provider.suggestReply for a SUGGEST_REPLY job", async () => {
      provider.suggestReply.mockResolvedValue(SUCCESS_RESULT);
      const job = buildJob({ ...PAYLOAD, feature: "SUGGEST_REPLY" });

      await processor.process(job);

      expect(provider.suggestReply).toHaveBeenCalledWith({ subject: "Login issue", body: "Checked logs." });
      expect(handbackQueue.add).toHaveBeenCalledWith(
        "ai-completion",
        expect.objectContaining({ feature: "SUGGEST_REPLY" }),
      );
    });

    it("calls provider.categorize for a CATEGORIZE job", async () => {
      provider.categorize.mockResolvedValue(SUCCESS_RESULT);
      const job = buildJob({ ...PAYLOAD, feature: "CATEGORIZE" });

      await processor.process(job);

      expect(provider.categorize).toHaveBeenCalledWith({ subject: "Login issue", body: "Checked logs." });
      expect(handbackQueue.add).toHaveBeenCalledWith(
        "ai-completion",
        expect.objectContaining({ feature: "CATEGORIZE" }),
      );
    });

    it("persists a DISABLED outcome and hands it back without throwing (NullAiProvider path)", async () => {
      const disabled: AiCallResult = {
        outcome: "DISABLED",
        text: null,
        model: "disabled",
        inputTokens: null,
        outputTokens: null,
        errorMessage: null,
      };
      provider.summarize.mockResolvedValue(disabled);
      const job = buildJob(PAYLOAD);

      await processor.process(job);

      expect(prisma.aiPromptLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: "DISABLED", model: "disabled", outputText: null }),
        }),
      );
      expect(handbackQueue.add).toHaveBeenCalledWith(
        "ai-completion",
        expect.objectContaining({ outcome: "DISABLED" }),
      );
    });

    it("persists an ERROR outcome and never throws when the provider itself throws", async () => {
      provider.summarize.mockRejectedValue(new Error("rate limited"));
      const job = buildJob(PAYLOAD);

      await expect(processor.process(job)).resolves.toBeUndefined();

      expect(prisma.aiPromptLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: "ERROR", errorMessage: "rate limited" }),
        }),
      );
      expect(handbackQueue.add).toHaveBeenCalledWith(
        "ai-completion",
        expect.objectContaining({ outcome: "ERROR" }),
      );
    });
  });
});
