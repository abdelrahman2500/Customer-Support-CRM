import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";
import type {
  BranchSummary,
  DepartmentSummary,
  PermissionSummary,
  RoleSummary,
  UserSummary,
} from "./identity.service";
import { IdentityService } from "./identity.service";

/**
 * Identity & Access management surface — see docs/architecture/03-domain-boundaries.md.
 * Split from `IdentityController` (which owns the `auth/*` session endpoints)
 * because this is a different concern: managing accounts/roles rather than
 * authenticating one. Every route here requires a specific permission
 * (checked by the globally-registered `PermissionsGuard` — see
 * `app.module.ts`), on top of the equally global `AuthGuard`.
 *
 * Branch **creation** remains explicitly out of scope — see the Story 03
 * plan. Story 35 added read-only branch/department listing
 * (`listBranches`/`listDepartments` below); Story 45 adds renaming and
 * activating/deactivating the caller's own branch (`PATCH branches/:id`)
 * and creating/renaming/activating/deactivating departments within the
 * caller's own branch (`POST departments`, `PATCH departments/:id`) — both
 * still scoped to the caller's own branch only, never another branch.
 *
 * Story 46 adds Role mutation: `POST roles` creates a custom Role,
 * `PATCH roles/:id` renames/activates/deactivates one, and
 * `PATCH roles/:id/permissions` full-replaces a Role's permission grants.
 * `Permission` rows themselves remain immutable/read-only — the catalog
 * stays code-defined (`prisma/seed.ts`), no client-defined permission key
 * is ever accepted. The two seeded roles, `SuperAdmin`/`Agent`, cannot be
 * renamed or deactivated (`PATCH roles/:id` rejects it with `400`), but
 * permission assignment on them via `PATCH roles/:id/permissions` is fully
 * allowed — granting `Agent` its first real permissions is the point.
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
  listRoles(@Query("includeInactive") includeInactive?: string): Promise<RoleSummary[]> {
    return this.identityService.listRoles(includeInactive === "true");
  }

  @Post("roles")
  @RequirePermissions("role:create")
  createRole(@Body() dto: CreateRoleDto): Promise<{ id: string }> {
    return this.identityService.createRole(dto);
  }

  @Patch("roles/:id")
  @RequirePermissions("role:update")
  updateRole(@Param("id") id: string, @Body() dto: UpdateRoleDto): Promise<{ id: string }> {
    return this.identityService.updateRole(id, dto);
  }

  @Patch("roles/:id/permissions")
  @RequirePermissions("role:assign-permissions")
  setRolePermissions(
    @Param("id") id: string,
    @Body() dto: SetRolePermissionsDto,
  ): Promise<{ id: string }> {
    return this.identityService.setRolePermissions(id, dto);
  }

  @Get("permissions")
  @RequirePermissions("permission:read")
  listPermissions(): Promise<PermissionSummary[]> {
    return this.identityService.listPermissions();
  }

  /**
   * Story 35 — read-only; scoped to the caller's own branch (see
   * `BranchSummary`'s doc comment in `identity.service.ts`). Shares
   * `branch:read` with `listDepartments` below, mirroring how `sla:read`
   * already covers both `SlaPolicy` and `BusinessHoursCalendar` — one
   * permission per small, closely-related resource area, not one per model.
   */
  @Get("branches")
  @RequirePermissions("branch:read")
  listBranches(@Query("includeInactive") includeInactive?: string): Promise<BranchSummary[]> {
    return this.identityService.listBranches(includeInactive === "true");
  }

  @Patch("branches/:id")
  @RequirePermissions("branch:update")
  updateBranch(@Param("id") id: string, @Body() dto: UpdateBranchDto): Promise<{ id: string }> {
    return this.identityService.updateBranch(id, dto);
  }

  @Get("departments")
  @RequirePermissions("branch:read")
  listDepartments(
    @Query("includeInactive") includeInactive?: string,
  ): Promise<DepartmentSummary[]> {
    return this.identityService.listDepartments(includeInactive === "true");
  }

  @Post("departments")
  @RequirePermissions("department:create")
  createDepartment(@Body() dto: CreateDepartmentDto): Promise<{ id: string }> {
    return this.identityService.createDepartment(dto);
  }

  @Patch("departments/:id")
  @RequirePermissions("department:update")
  updateDepartment(
    @Param("id") id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<{ id: string }> {
    return this.identityService.updateDepartment(id, dto);
  }
}
