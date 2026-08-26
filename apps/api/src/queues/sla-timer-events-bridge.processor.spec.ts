import { describe, expect, it, vi } from "vitest";
import { SlaTimerEventsBridgeProcessor } from "./sla-timer-events-bridge.processor";
import type { SlaDetectionJobPayload } from "./sla-timer-events-bridge.processor";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";

function buildEventEmitterMock() {
  return {
    emit: vi.fn(),
  };
}

function createProcessor(emitterMock: ReturnType<typeof buildEventEmitterMock>): SlaTimerEventsBridgeProcessor {
  return new SlaTimerEventsBridgeProcessor(emitterMock as unknown as EventEmitter2);
}

function buildJob(data: SlaDetectionJobPayload): Job<SlaDetectionJobPayload> {
  return { data } as Job<SlaDetectionJobPayload>;
}

describe("SlaTimerEventsBridgeProcessor", () => {
  describe("process", () => {
    it("emits sla.at_risk with a Date-converted payload for an at-risk job", async () => {
      const emitter = buildEventEmitterMock();
      const processor = createProcessor(emitter);
      const job = buildJob({
        eventType: "sla.at_risk",
        ticketId: "ticket-1",
        branchId: "branch-1",
        targetType: "response",
        targetAt: "2026-01-01T10:00:00.000Z",
      });

      await processor.process(job);

      expect(emitter.emit).toHaveBeenCalledOnce();
      expect(emitter.emit).toHaveBeenCalledWith("sla.at_risk", {
        ticketId: "ticket-1",
        branchId: "branch-1",
        targetType: "response",
        targetAt: new Date("2026-01-01T10:00:00.000Z"),
      });
    });

    it("emits sla.breached with a Date-converted payload for a breached job", async () => {
      const emitter = buildEventEmitterMock();
      const processor = createProcessor(emitter);
      const job = buildJob({
        eventType: "sla.breached",
        ticketId: "ticket-2",
        branchId: "branch-2",
        targetType: "resolution",
        targetAt: "2026-01-02T10:00:00.000Z",
      });

      await processor.process(job);

      expect(emitter.emit).toHaveBeenCalledOnce();
      expect(emitter.emit).toHaveBeenCalledWith("sla.breached", {
        ticketId: "ticket-2",
        branchId: "branch-2",
        targetType: "resolution",
        targetAt: new Date("2026-01-02T10:00:00.000Z"),
      });
    });
  });
});
