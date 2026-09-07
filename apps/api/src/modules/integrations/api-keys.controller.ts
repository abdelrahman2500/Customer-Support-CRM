import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import type { ApiKeyCreated, ApiKeySummary } from "./api-keys.service";
import { ApiKeysService } from "./api-keys.service";

/** RM-22 — admin CRUD for issuing/revoking machine-to-machine API keys.
 * JWT-authenticated, gated by the same `integration:manage` permission
 * `WebhookSubscriptionsController` uses (issuing a credential is exactly
 * the kind of admin-configuration action that permission already covers) —
 * never itself reachable via `@AllowApiKey()`: a key cannot be used to
 * mint or revoke other keys. */
@ApiTags("integrations")
@ApiBearerAuth()
@Controller("integrations/api-keys")
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @RequirePermissions("integration:manage")
  create(@Body() dto: CreateApiKeyDto): Promise<ApiKeyCreated> {
    return this.apiKeysService.createApiKey(dto);
  }

  @Get()
  @RequirePermissions("integration:manage")
  list(): Promise<ApiKeySummary[]> {
    return this.apiKeysService.listApiKeys();
  }

  @Delete(":id")
  @RequirePermissions("integration:manage")
  async revoke(@Param("id") id: string): Promise<{ id: string }> {
    await this.apiKeysService.revokeApiKey(id);
    return { id };
  }
}
