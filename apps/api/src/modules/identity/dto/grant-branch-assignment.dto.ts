import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

/**
 * Story 118 — `POST identity/users/:id/branch-assignments`. Unlike
 * `UpdateUserAssignmentDto`, `departmentId` here is a plain optional
 * field (no tri-state `null`-to-clear semantics needed): this creates a
 * brand-new `UserBranchRole` row, so "omitted" and "explicitly null"
 * mean the same thing (a branch-wide role, no department) — there is no
 * existing value to preserve.
 */
export class GrantBranchAssignmentDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty()
  @IsUUID()
  roleId!: string;
}
