import { ApiProperty } from "@nestjs/swagger";
import type { TicketVisibilityScope } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

const TICKET_VISIBILITY_SCOPE_VALUES: TicketVisibilityScope[] = ["BRANCH", "DEPARTMENT"];

export class UpdateRoleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Story 68 — omitted leaves the role's current scope untouched. */
  @ApiProperty({ required: false, enum: TICKET_VISIBILITY_SCOPE_VALUES })
  @IsOptional()
  @IsEnum(TICKET_VISIBILITY_SCOPE_VALUES)
  ticketVisibilityScope?: TicketVisibilityScope;
}
