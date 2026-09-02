import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

/** Story 118 — `POST auth/switch-branch`. `departmentId` omitted means
 * "switch to this branch's own branch-wide (no-department) membership" —
 * the caller's own `GET auth/me/branches` response always lists the
 * exact `(branchId, departmentId)` pairs it actually holds, so there is
 * no ambiguity for a real client to resolve here. */
export class SwitchBranchDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
