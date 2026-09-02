import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

/**
 * Story 101 — mirrors `ListTicketsQueryDto`'s exact shape/validation
 * style (`apps/api/src/modules/tickets/dto/list-tickets-query.dto.ts`).
 * No pagination — same "no precedent anywhere in this codebase" reason
 * that DTO's own doc comment already gives.
 */
export class ListCustomersQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  // Query-string params arrive as strings, never real booleans — mirrors
  // `IdentityController.listBranches`'s existing `@Query("includeInactive")
  // includeInactive?: string` precedent (compared manually as `=== "true"`
  // in the service), via the same validated-string-literal `@IsIn`
  // pattern `sortDir` below already uses — not a new `@Transform`-based
  // boolean coercion this codebase has never used.
  @ApiProperty({ required: false, enum: ["true", "false"] })
  @IsOptional()
  @IsIn(["true", "false"])
  isActive?: "true" | "false";

  @ApiProperty({ required: false, enum: ["displayName", "createdAt"] })
  @IsOptional()
  @IsIn(["displayName", "createdAt"])
  sortBy?: "displayName" | "createdAt";

  @ApiProperty({ required: false, enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
