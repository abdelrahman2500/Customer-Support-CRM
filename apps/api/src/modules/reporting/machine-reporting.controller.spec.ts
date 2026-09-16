import { describe, expect, it, vi } from "vitest";
import { MachineReportingController } from "./machine-reporting.controller";
import type { ReportingService, TicketVolumeByStatus } from "./reporting.service";

/**
 * Story 133 — unit coverage for the machine-facing reporting controller.
 *
 * Deliberately narrow: this controller's whole job is to map the query DTO
 * through the SHARED `toFilters()` and delegate to the existing
 * `ReportingService`. Branch scoping, the `crossBranch` 403 and every
 * authentication outcome belong to `ApiKeyGuard`/`TenantContext`/
 * `ReportingService` and are asserted against the real running app in
 * `test/machine-reporting.e2e-spec.ts` — reproducing them against a mock
 * here would only prove the mock.
 */
function buildReportingServiceMock(rows: TicketVolumeByStatus[] = []) {
  return { getTicketVolumeByStatus: vi.fn().mockResolvedValue(rows) };
}

function createController(
  serviceMock: ReturnType<typeof buildReportingServiceMock>,
): MachineReportingController {
  return new MachineReportingController(serviceMock as unknown as ReportingService);
}

describe("MachineReportingController", () => {
  describe("getTicketVolume", () => {
    it("delegates to the existing ReportingService rather than querying itself", async () => {
      const service = buildReportingServiceMock();
      const controller = createController(service);

      await controller.getTicketVolume({});

      expect(service.getTicketVolumeByStatus).toHaveBeenCalledOnce();
    });

    it("returns the service's rows unchanged", async () => {
      const rows: TicketVolumeByStatus[] = [
        { status: "OPEN", count: 3 },
        { status: "RESOLVED", count: 7 },
      ];
      const controller = createController(buildReportingServiceMock(rows));

      await expect(controller.getTicketVolume({})).resolves.toEqual(rows);
    });

    it("passes every filter field through the shared toFilters mapper", async () => {
      const service = buildReportingServiceMock();
      const controller = createController(service);

      await controller.getTicketVolume({
        from: "2026-01-01",
        to: "2026-01-31",
        departmentId: "11111111-1111-1111-1111-111111111111",
        assignedToUserId: "22222222-2222-2222-2222-222222222222",
        categoryId: "33333333-3333-3333-3333-333333333333",
      });

      expect(service.getTicketVolumeByStatus).toHaveBeenCalledWith({
        from: "2026-01-01",
        to: "2026-01-31",
        departmentId: "11111111-1111-1111-1111-111111111111",
        assignedToUserId: "22222222-2222-2222-2222-222222222222",
        categoryId: "33333333-3333-3333-3333-333333333333",
        crossBranch: false,
      });
    });

    // The one behaviour that proves this controller reuses `ReportingController`'s
    // exported mapper rather than keeping a private copy: `crossBranch` arrives as
    // the string `"true"`/`"false"` and must become a real boolean exactly once.
    it("converts crossBranch='true' to a real boolean via the shared mapper", async () => {
      const service = buildReportingServiceMock();
      const controller = createController(service);

      await controller.getTicketVolume({ crossBranch: "true" });

      expect(service.getTicketVolumeByStatus).toHaveBeenCalledWith(
        expect.objectContaining({ crossBranch: true }),
      );
    });

    it("treats an absent crossBranch as false, never undefined", async () => {
      const service = buildReportingServiceMock();
      const controller = createController(service);

      await controller.getTicketVolume({});

      expect(service.getTicketVolumeByStatus).toHaveBeenCalledWith(
        expect.objectContaining({ crossBranch: false }),
      );
    });
  });
});
