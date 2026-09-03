import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCallResult, AiProvider } from "@crm/ai";
import type { AiProcessingJobPayload } from "./ai-processing.processor";
import type { PrismaService } from "../prisma/prisma.service";
import type { Job, Queue } from "bullmq";
import { CorrelationIdStore } from "../common/logging/correlation-id.store";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

// Imported after the mock so the mocked module is what the processor sees.
import * as Sentry from "@sentry/node";
import { AiProcessingProcessor, AI_PROCESSING_QUEUE } from "./ai-processing.processor";

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
    chatMessage: {
      create: vi.fn().mockResolvedValue({}),
      // Story 116 — defaults to "no prior history" (just the current
      // customer message, dropped by `fetchChatHistory`'s own
      // `.slice(1)`), matching the pre-Story-116 CHAT_PAYLOAD tests below
      // that never set up any chat history explicitly.
      findMany: vi.fn().mockResolvedValue([
        { id: "current-message", role: "CUSTOMER", body: "Hi, I need help", createdAt: new Date() },
      ]),
    },
    // Story 117 — `fetchKnowledgeBaseContext`'s tagged-template
    // `$queryRaw` call. Defaults to "no matching article" (the common
    // case in the pre-Story-117 CHAT_PAYLOAD tests below, none of which
    // set up any Knowledge Base content).
    $queryRaw: vi.fn().mockResolvedValue([]),
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
          // Story 121 — "claude-test" has no entry in the price table
          // (it's a test fixture, not a real Anthropic model id), so
          // computeCostMicroUsd correctly returns null here, never a
          // fabricated 0 — see that util's own dedicated spec for the
          // known-model cases.
          costMicroUsd: null,
        },
      });
      expect(handbackQueue.add).toHaveBeenCalledWith("ai-completion", {
        aiPromptLogId: "log-1",
        ticketId: "ticket-1",
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
      });
    });

    // Story 111 — Structured logging & correlation IDs.
    it("binds the job's own correlationId for the lifetime of processing it", async () => {
      let seenDuringProcessing: string | undefined;
      provider.summarize.mockImplementation(async () => {
        seenDuringProcessing = CorrelationIdStore.get();
        return SUCCESS_RESULT;
      });
      const job = buildJob({ ...PAYLOAD, correlationId: "request-abc" });

      await processor.process(job);

      expect(seenDuringProcessing).toBe("request-abc");
      expect(CorrelationIdStore.get()).toBeUndefined();
    });

    it("falls back to a freshly generated id when the job carries no correlationId", async () => {
      let seenDuringProcessing: string | undefined;
      provider.summarize.mockImplementation(async () => {
        seenDuringProcessing = CorrelationIdStore.get();
        return SUCCESS_RESULT;
      });
      const job = buildJob(PAYLOAD);

      await processor.process(job);

      expect(seenDuringProcessing).toBeTypeOf("string");
      expect(seenDuringProcessing).not.toBe("");
    });

    // Story 121 — AI Usage/Cost Reporting.
    it("persists a real computed costMicroUsd for a real, priced model", async () => {
      provider.summarize.mockResolvedValue({
        outcome: "SUCCESS",
        text: "A summary.",
        model: "claude-sonnet-4-5-20250929",
        inputTokens: 500,
        outputTokens: 200,
        errorMessage: null,
      });
      const job = buildJob(PAYLOAD);

      await processor.process(job);

      // 500 * $3/M + 200 * $15/M = 1500 + 3000 = 4500 micro-USD.
      expect(prisma.aiPromptLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ costMicroUsd: 4500 }) }),
      );
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

    // Story 113 — Error tracking.
    it("reports the provider's error to Sentry (the job itself never fails at the BullMQ level)", async () => {
      const error = new Error("rate limited");
      provider.summarize.mockRejectedValue(error);
      const job = buildJob(PAYLOAD);

      await processor.process(job);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    describe("onFailed", () => {
      it("reports a genuinely unhandled exception (e.g. outside the try/catch) to Sentry, tagged with the queue and job id", () => {
        const error = new Error("Prisma connection lost");
        const job = { id: "job-42" } as Job<AiProcessingJobPayload>;

        processor.onFailed(job, error);

        expect(Sentry.captureException).toHaveBeenCalledWith(error, {
          tags: { queue: AI_PROCESSING_QUEUE, jobId: "job-42" },
        });
      });

      it("tolerates an undefined job (BullMQ's own documented stalled-job case)", () => {
        const error = new Error("stalled");

        processor.onFailed(undefined, error);

        expect(Sentry.captureException).toHaveBeenCalledWith(error, {
          tags: { queue: AI_PROCESSING_QUEUE, jobId: undefined },
        });
      });
    });

    // Story 80 — AI Portal Chatbot.
    describe("CHAT feature", () => {
      const CHAT_PAYLOAD: AiProcessingJobPayload = {
        aiPromptLogId: "log-1",
        branchId: "branch-1",
        feature: "CHAT",
        body: "Hi, I need help",
        chatSessionId: "session-1",
      };

      it("calls provider.chat with { sessionId, message, history, context } and never the ticket-scoped methods", async () => {
        provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
        const job = buildJob(CHAT_PAYLOAD);

        await processor.process(job);

        expect(provider.chat).toHaveBeenCalledWith({
          sessionId: "session-1",
          message: "Hi, I need help",
          history: [],
          context: [],
        });
        expect(provider.summarize).not.toHaveBeenCalled();
        expect(provider.suggestReply).not.toHaveBeenCalled();
        expect(provider.categorize).not.toHaveBeenCalled();
      });

      // Story 116 — conversation memory.
      describe("chat history (Story 116)", () => {
        it("fetches history scoped to the session, bounded to CHAT_HISTORY_LIMIT + 1 rows, newest-first", async () => {
          provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
          const job = buildJob(CHAT_PAYLOAD);

          await processor.process(job);

          expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
            where: { sessionId: "session-1" },
            orderBy: { createdAt: "desc" },
            take: 21,
          });
        });

        it("excludes the current (just-persisted) customer message and orders the rest oldest-first, role-mapped", async () => {
          provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
          prisma.chatMessage.findMany.mockResolvedValue([
            // newest-first, as a real `orderBy: desc` query returns.
            { id: "3", role: "CUSTOMER", body: "And then what happened?", createdAt: new Date() },
            { id: "2", role: "ASSISTANT", body: "What's your order number?", createdAt: new Date() },
            { id: "1", role: "CUSTOMER", body: "I ordered a widget.", createdAt: new Date() },
          ]);
          const job = buildJob(CHAT_PAYLOAD);

          await processor.process(job);

          expect(provider.chat).toHaveBeenCalledWith({
            sessionId: "session-1",
            message: "Hi, I need help",
            history: [
              { role: "user", content: "I ordered a widget." },
              { role: "assistant", content: "What's your order number?" },
            ],
            context: [],
          });
        });

        it("passes an empty history array for a session's first-ever message", async () => {
          provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
          prisma.chatMessage.findMany.mockResolvedValue([
            { id: "current-message", role: "CUSTOMER", body: "Hi, I need help", createdAt: new Date() },
          ]);
          const job = buildJob(CHAT_PAYLOAD);

          await processor.process(job);

          expect(provider.chat).toHaveBeenCalledWith({
            sessionId: "session-1",
            message: "Hi, I need help",
            history: [],
            context: [],
          });
        });
      });

      // Story 117 — Knowledge Base grounding.
      describe("Knowledge Base context (Story 117)", () => {
        it("queries the Knowledge Base scoped to the job's branchId, using the current message as the search query", async () => {
          provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
          const job = buildJob(CHAT_PAYLOAD);

          await processor.process(job);

          expect(prisma.$queryRaw).toHaveBeenCalledOnce();
          const [strings, ...values] = prisma.$queryRaw.mock.calls[0]!;
          expect(strings.join("")).toContain("branch_id =");
          expect(strings.join("")).toContain("status = 'PUBLISHED'");
          expect(values).toContain(CHAT_PAYLOAD.branchId);
          expect(values).toContain(CHAT_PAYLOAD.body);
        });

        it("passes matching articles as context, truncated and formatted as 'title: excerpt'", async () => {
          provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
          prisma.$queryRaw.mockResolvedValue([
            { title: "Password reset", body: "Go to Settings and click Reset Password." },
            { title: "Account lockout", body: "Wait 15 minutes after 5 failed attempts." },
          ]);
          const job = buildJob(CHAT_PAYLOAD);

          await processor.process(job);

          expect(provider.chat).toHaveBeenCalledWith(
            expect.objectContaining({
              context: [
                "Password reset: Go to Settings and click Reset Password.",
                "Account lockout: Wait 15 minutes after 5 failed attempts.",
              ],
            }),
          );
        });

        it("truncates an excerpt longer than 500 characters", async () => {
          provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
          const longBody = "x".repeat(600);
          prisma.$queryRaw.mockResolvedValue([{ title: "Long article", body: longBody }]);
          const job = buildJob(CHAT_PAYLOAD);

          await processor.process(job);

          const call = provider.chat.mock.calls[0]![0];
          expect(call.context[0]).toBe(`Long article: ${"x".repeat(500)}`);
        });

        it("fails open (empty context) when the Knowledge Base query throws, without failing the job", async () => {
          provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
          prisma.$queryRaw.mockRejectedValue(new Error("connection reset"));
          const job = buildJob(CHAT_PAYLOAD);

          await processor.process(job);

          expect(provider.chat).toHaveBeenCalledWith(
            expect.objectContaining({ context: [] }),
          );
          expect(prisma.aiPromptLog.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ outcome: "SUCCESS" }) }),
          );
        });
      });

      it("on SUCCESS, persists the reply as a ChatMessage(ASSISTANT) row", async () => {
        provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
        const job = buildJob(CHAT_PAYLOAD);

        await processor.process(job);

        expect(prisma.chatMessage.create).toHaveBeenCalledWith({
          data: { sessionId: "session-1", role: "ASSISTANT", body: "How can I help?" },
        });
      });

      it("on ERROR, never creates a ChatMessage row", async () => {
        provider.chat.mockRejectedValue(new Error("rate limited"));
        const job = buildJob(CHAT_PAYLOAD);

        await processor.process(job);

        expect(prisma.chatMessage.create).not.toHaveBeenCalled();
      });

      it("on DISABLED, never creates a ChatMessage row", async () => {
        provider.chat.mockResolvedValue({
          outcome: "DISABLED",
          text: null,
          model: "disabled",
          inputTokens: null,
          outputTokens: null,
          errorMessage: null,
        });
        const job = buildJob(CHAT_PAYLOAD);

        await processor.process(job);

        expect(prisma.chatMessage.create).not.toHaveBeenCalled();
      });

      it("hands back chatSessionId, never ticketId", async () => {
        provider.chat.mockResolvedValue({ ...SUCCESS_RESULT, text: "How can I help?" });
        const job = buildJob(CHAT_PAYLOAD);

        await processor.process(job);

        expect(handbackQueue.add).toHaveBeenCalledWith("ai-completion", {
          aiPromptLogId: "log-1",
          feature: "CHAT",
          outcome: "SUCCESS",
          chatSessionId: "session-1",
        });
      });
    });
  });
});
