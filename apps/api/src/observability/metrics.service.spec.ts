import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Queue } from "bullmq";
import { MetricsService } from "./metrics.service";

function buildQueueMock(counts: Partial<Record<string, number>> = {}) {
  return {
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      ...counts,
    }),
  } as unknown as Queue;
}

function createService(queueMocks?: {
  healthCheck?: Queue;
  slaTimers?: Queue;
  slaTimerEvents?: Queue;
  aiProcessing?: Queue;
  aiProcessingEvents?: Queue;
}): MetricsService {
  return new MetricsService(
    queueMocks?.healthCheck ?? buildQueueMock(),
    queueMocks?.slaTimers ?? buildQueueMock(),
    queueMocks?.slaTimerEvents ?? buildQueueMock(),
    queueMocks?.aiProcessing ?? buildQueueMock(),
    queueMocks?.aiProcessingEvents ?? buildQueueMock(),
  );
}

describe("MetricsService", () => {
  beforeEach(() => {
    // prom-client's default `register` is a process-wide singleton, but
    // this service always constructs and reads from its own private
    // `Registry` instance (never the default one) — see the constructor.
    // No cross-test cleanup of a shared registry is therefore needed.
  });

  describe("observeHttpRequest / render", () => {
    it("includes an observed HTTP request in the rendered output", async () => {
      const service = createService();

      service.observeHttpRequest("GET", "/tickets/:id", 200, 0.123);
      const output = await service.render();

      expect(output).toContain("http_request_duration_seconds");
      expect(output).toContain('method="GET"');
      expect(output).toContain('route="/tickets/:id"');
      expect(output).toContain('status_code="200"');
    });

    it("stringifies the status code label", async () => {
      const service = createService();

      service.observeHttpRequest("POST", "/tickets", 500, 0.05);
      const output = await service.render();

      expect(output).toContain('status_code="500"');
    });
  });

  describe("render — queue gauges", () => {
    it("refreshes every queue's job counts before rendering", async () => {
      const aiProcessing = buildQueueMock({ waiting: 3, active: 1, failed: 2 });
      const service = createService({ aiProcessing });

      const output = await service.render();

      expect(aiProcessing.getJobCounts).toHaveBeenCalledWith(
        "waiting",
        "active",
        "delayed",
        "failed",
      );
      expect(output).toContain('bullmq_queue_jobs{queue="ai-processing",state="waiting"} 3');
      expect(output).toContain('bullmq_queue_jobs{queue="ai-processing",state="active"} 1');
      expect(output).toContain('bullmq_queue_jobs{queue="ai-processing",state="failed"} 2');
    });

    it("labels each queue by its own real queue name", async () => {
      const service = createService();

      const output = await service.render();

      for (const queueName of [
        "health-check",
        "sla-timers",
        "sla-timer-events",
        "ai-processing",
        "ai-processing-events",
      ]) {
        expect(output).toContain(`queue="${queueName}"`);
      }
    });

    it("defaults a missing state count to 0", async () => {
      const healthCheck = {
        getJobCounts: vi.fn().mockResolvedValue({ waiting: 5 }),
      } as unknown as Queue;
      const service = createService({ healthCheck });

      const output = await service.render();

      expect(output).toContain('bullmq_queue_jobs{queue="health-check",state="active"} 0');
    });
  });

  describe("contentType", () => {
    it("exposes prom-client's own Prometheus content-type string", () => {
      const service = createService();

      expect(service.contentType).toContain("text/plain");
    });
  });
});
