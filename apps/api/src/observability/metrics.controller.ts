import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../common/auth/public.decorator";
import { MetricsService } from "./metrics.service";

/**
 * Story 112 — docs/architecture/11-quality-and-operations.md:
 * "Prometheus-format `/metrics` endpoints expose request, queue, and
 * processing metrics for Grafana dashboards." `@Public()` and excluded
 * from the global `api/v1` prefix (see `main.ts`), mirroring
 * `HealthController`'s own two liveness/readiness routes — a Prometheus
 * scraper is not an authenticated API caller, exactly like a container
 * orchestrator's health probe.
 */
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get("metrics")
  async getMetrics(@Res() response: Response): Promise<void> {
    response.setHeader("Content-Type", this.metrics.contentType);
    response.send(await this.metrics.render());
  }
}
