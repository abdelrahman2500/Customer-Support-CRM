import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import type { PermissionSummary, RoleSummary, UserSummary } from "./identity.service";
import { IdentityService } from "./identity.service";

/**
 * Identity & Access management surface — see docs/architecture/03-domain-boundaries.md.
 * Split from `IdentityController` (which owns the `auth/*` session endpoints)
 * because this is a different concern: managing accounts/roles rather than
 * authenticating one. Every route here requires a specific permission
 * (checked by the globally-registered `PermissionsGuard` — see
 * `app.module.ts`), on top of the equally global `AuthGuard`.
 *
 * Branch/department/role/permission **mutation** endpoints are explicitly
 * out of scope for this story — see the Story 03 plan.
 */
@ApiTags("identity")
@ApiBearerAuth()
@Controller("identity")
export class UsersController {
  constructor(private readonly identityService: IdentityService) {}

  @Post("users")
  @RequirePermissions("user:create")
  createUser(@Body() dto: CreateUserDto): Promise<{ id: string; email: string }> {
    return this.identityService.createUser(dto);
  }

  @Get("users")
  @RequirePermissions("user:read")
  listUsers(): Promise<UserSummary[]> {
    return this.identityService.listUsers();
  }

  @Patch("users/:id")
  @RequirePermissions("user:update")
  updateUser(@Param("id") id: string, @Body() dto: UpdateUserDto): Promise<{ id: string }> {
    return this.identityService.updateUser(id, dto);
  }

  @Get("roles")
  @RequirePermissions("role:read")
  listRoles(): Promise<RoleSummary[]> {
    return this.identityService.listRoles();
  }

  @Get("permissions")
  @RequirePermissions("permission:read")
  listPermissions(): Promise<PermissionSummary[]> {
    return this.identityService.listPermissions();
  }
}
