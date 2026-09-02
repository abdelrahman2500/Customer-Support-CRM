import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Story 107 — `timezone` is a plain, unvalidated string, mirroring
 * `UpdateBranchDto`'s own existing (equally unvalidated) `timezone` field
 * rather than inventing a stricter check only here. `organizationId` is
 * deliberately not a field on this DTO at all: it is resolved from the
 * caller's own branch, never accepted from the client (see
 * `IdentityService.createBranch`).
 */
export class CreateBranchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  timezone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
