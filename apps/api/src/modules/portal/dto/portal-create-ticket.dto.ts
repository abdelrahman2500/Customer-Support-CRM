import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

/**
 * Story 53 — deliberately narrower than `CreateTicketDto`: no `customerId`/
 * `contactId` (always derived server-side from the authenticated Contact,
 * never client-supplied), no `departmentId`/`assignedToUserId`/`priority`
 * (internal agent-triage concerns a customer doesn't set).
 */
export class PortalCreateTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  subject!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;
}
