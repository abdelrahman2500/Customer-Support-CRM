import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { MetricsController } from "./metrics.controller";
import type { MetricsService } from "./metrics.service";

function buildMetricsServiceMock() {
  return {
    contentType: "text/plain; version=0.0.4; charset=utf-8",
    render: vi.fn().mockResolvedValue("# HELP fake_metric ...\nfake_metric 1\n"),
  } as unknown as MetricsService;
}

function buildResponseMock() {
  return { setHeader: vi.fn(), send: vi.fn() } as unknown as Response;
}

describe("MetricsController", () => {
  it("sets the Prometheus content-type header from MetricsService", async () => {
    const metrics = buildMetricsServiceMock();
    const controller = new MetricsController(metrics);
    const response = buildResponseMock();

    await controller.getMetrics(response);

    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", metrics.contentType);
  });

  it("sends the rendered registry output as the response body", async () => {
    const metrics = buildMetricsServiceMock();
    const controller = new MetricsController(metrics);
    const response = buildResponseMock();

    await controller.getMetrics(response);

    expect(response.send).toHaveBeenCalledWith("# HELP fake_metric ...\nfake_metric 1\n");
  });
});
