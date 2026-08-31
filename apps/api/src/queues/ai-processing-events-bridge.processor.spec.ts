import { describe, expect, it, vi } from "vitest";
import { AiProcessingEventsBridgeProcessor } from "./ai-processing-events-bridge.processor";
import type { AiCompletionJobPayload } from "./ai-processing-events-bridge.processor";
import { AI_PROMPT_COMPLETED_EVENT } from "../modules/ai/ai.events";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";

function buildEventEmitterMock() {
  return {
    emit: vi.fn(),
  };
}

function createProcessor(
  emitterMock: ReturnType<typeof buildEventEmitterMock>,
): AiProcessingEventsBridgeProcessor {
  return new AiProcessingEventsBridgeProcessor(emitterMock as unknown as EventEmitter2);
}

function buildJob(data: AiCompletionJobPayload): Job<AiCompletionJobPayload> {
  return { data } as Job<AiCompletionJobPayload>;
}

describe("AiProcessingEventsBridgeProcessor", () => {
  describe("process", () => {
    it("emits ai.prompt_completed with the job's payload for a SUCCESS outcome", async () => {
      const emitter = buildEventEmitterMock();
      const processor = createProcessor(emitter);
      const job = buildJob({
        aiPromptLogId: "log-1",
        ticketId: "ticket-1",
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
      });

      await processor.process(job);

      expect(emitter.emit).toHaveBeenCalledOnce();
      expect(emitter.emit).toHaveBeenCalledWith(AI_PROMPT_COMPLETED_EVENT, {
        aiPromptLogId: "log-1",
        ticketId: "ticket-1",
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
      });
    });

    it("emits ai.prompt_completed for an ERROR outcome exactly like a SUCCESS one", async () => {
      const emitter = buildEventEmitterMock();
      const processor = createProcessor(emitter);
      const job = buildJob({
        aiPromptLogId: "log-2",
        ticketId: "ticket-2",
        feature: "CATEGORIZE",
        outcome: "ERROR",
      });

      await processor.process(job);

      expect(emitter.emit).toHaveBeenCalledWith(AI_PROMPT_COMPLETED_EVENT, {
        aiPromptLogId: "log-2",
        ticketId: "ticket-2",
        feature: "CATEGORIZE",
        outcome: "ERROR",
      });
    });

    it("emits ai.prompt_completed for a DISABLED outcome exactly like a SUCCESS one", async () => {
      const emitter = buildEventEmitterMock();
      const processor = createProcessor(emitter);
      const job = buildJob({
        aiPromptLogId: "log-3",
        ticketId: "ticket-3",
        feature: "SUGGEST_REPLY",
        outcome: "DISABLED",
      });

      await processor.process(job);

      expect(emitter.emit).toHaveBeenCalledWith(AI_PROMPT_COMPLETED_EVENT, {
        aiPromptLogId: "log-3",
        ticketId: "ticket-3",
        feature: "SUGGEST_REPLY",
        outcome: "DISABLED",
      });
    });
  });
});
