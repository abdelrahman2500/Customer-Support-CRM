import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";
import type { AutomationRuleSummary } from "./automation-rules.service";
import { AutomationRulesService } from "./automation-rules.service";

@ApiTags("automation-rules")
@ApiBearerAuth()
@Controller("automation-rules")
export class AutomationRulesController {
  constructor(private readonly automationRulesService: AutomationRulesService) {}

  @Post()
  @RequirePermissions("automation:create")
  create(@Body() dto: CreateAutomationRuleDto): Promise<AutomationRuleSummary> {
    return this.automationRulesService.createAutomationRule(dto);
  }

  @Get()
  @RequirePermissions("automation:read")
  list(): Promise<AutomationRuleSummary[]> {
    return this.automationRulesService.listAutomationRules();
  }

  @Get(":id")
  @RequirePermissions("automation:read")
  getOne(@Param("id") id: string): Promise<AutomationRuleSummary> {
    return this.automationRulesService.getAutomationRule(id);
  }

  @Patch(":id")
  @RequirePermissions("automation:update")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ): Promise<{ id: string }> {
    return this.automationRulesService.updateAutomationRule(id, dto);
  }
}
