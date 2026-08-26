import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type { SlaTargetSummary } from "./sla-targets.service";
import { SlaTargetsService } from "./sla-targets.service";

/**
 * Deliberately routed under `/tickets`, not `/sla-policies` — this is "the
 * SLA target belonging to this ticket," a ticket-scoped read, even though
 * the owning module/schema is `sla` (Settled decision 1/7). Nothing prevents
 * a second controller declaring routes under an existing path prefix; this
 * mirrors `CustomersModule` already hosting two controllers
 * (`CustomersController` + `ContactsController`).
 */
@ApiTags("sla-targets")
@ApiBearerAuth()
@Controller("tickets")
export class SlaTargetsController {
  constructor(private readonly slaTargetsService: SlaTargetsService) {}

  @Get(":id/sla-target")
  @RequirePermissions("sla:read")
  getOne(@Param("id") id: string): Promise<SlaTargetSummary> {
    return this.slaTargetsService.getSlaTargetForTicket(id);
  }
}
