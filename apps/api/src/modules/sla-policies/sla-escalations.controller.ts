import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type { SlaEscalationSummary } from "./sla-escalations.service";
import { SlaEscalationsService } from "./sla-escalations.service";

/**
 * Deliberately routed under `/tickets`, not `/sla-policies` — mirrors
 * `SlaTargetsController`'s exact precedent: "the SLA escalation history
 * belonging to this ticket" is a ticket-scoped read, even though the owning
 * module/schema is `sla`.
 */
@ApiTags("sla-escalations")
@ApiBearerAuth()
@Controller("tickets")
export class SlaEscalationsController {
  constructor(private readonly slaEscalationsService: SlaEscalationsService) {}

  @Get(":id/sla-escalations")
  @RequirePermissions("sla:read")
  list(@Param("id") id: string): Promise<SlaEscalationSummary[]> {
    return this.slaEscalationsService.getEscalationsForTicket(id);
  }
}
