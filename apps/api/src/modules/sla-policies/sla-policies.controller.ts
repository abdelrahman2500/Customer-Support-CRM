import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateSlaPolicyDto } from "./dto/create-sla-policy.dto";
import { UpdateSlaPolicyDto } from "./dto/update-sla-policy.dto";
import type { SlaPolicySummary } from "./sla-policies.service";
import { SlaPoliciesService } from "./sla-policies.service";

@ApiTags("sla-policies")
@ApiBearerAuth()
@Controller("sla-policies")
export class SlaPoliciesController {
  constructor(private readonly slaPoliciesService: SlaPoliciesService) {}

  @Post()
  @RequirePermissions("sla:create")
  create(@Body() dto: CreateSlaPolicyDto): Promise<SlaPolicySummary> {
    return this.slaPoliciesService.createSlaPolicy(dto);
  }

  @Get()
  @RequirePermissions("sla:read")
  list(): Promise<SlaPolicySummary[]> {
    return this.slaPoliciesService.listSlaPolicies();
  }

  @Get(":id")
  @RequirePermissions("sla:read")
  getOne(@Param("id") id: string): Promise<SlaPolicySummary> {
    return this.slaPoliciesService.getSlaPolicy(id);
  }

  @Patch(":id")
  @RequirePermissions("sla:update")
  update(@Param("id") id: string, @Body() dto: UpdateSlaPolicyDto): Promise<{ id: string }> {
    return this.slaPoliciesService.updateSlaPolicy(id, dto);
  }
}
