import { ApiProperty } from "@nestjs/swagger";
import type { TicketVisibilityScope } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

const TICKET_VISIBILITY_SCOPE_VALUES: TicketVisibilityScope[] = ["BRANCH", "DEPARTMENT"];

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** Story 68 — omitted defaults to `BRANCH` (matches the Prisma column
   * default exactly), reproducing every pre-Story-68 caller's behavior. */
  @ApiProperty({ required: false, enum: TICKET_VISIBILITY_SCOPE_VALUES })
  @IsOptional()
  @IsEnum(TICKET_VISIBILITY_SCOPE_VALUES)
  ticketVisibilityScope?: TicketVisibilityScope;
}
