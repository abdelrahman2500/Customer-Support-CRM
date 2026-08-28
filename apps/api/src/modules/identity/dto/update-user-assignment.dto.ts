import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID, ValidateIf } from "class-validator";

export class UpdateUserAssignmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  // Tri-state: `undefined` (field omitted) = leave the department unchanged;
  // `null` = explicitly clear it (branch-wide role, no department); a real
  // UUID string = set it to that department. `@ValidateIf` lets an explicit
  // `null` through without failing `@IsUUID()`, while still validating a
  // real string value as a UUID.
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.departmentId !== null)
  @IsUUID()
  departmentId?: string | null;
}
