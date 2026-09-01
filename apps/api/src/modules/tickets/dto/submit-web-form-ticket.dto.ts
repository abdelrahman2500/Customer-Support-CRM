import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

/**
 * Story 87 — Communication/Channels: Public Web-Form Ticket Intake.
 * Deliberately narrow, like `PortalCreateTicketDto`: no `customerId`/
 * `contactId`/`priority`/`departmentId`/`assignedToUserId` — an anonymous
 * submitter sets even less than a portal-authenticated one. `branchId` is
 * required here (unlike every other ticket-creation DTO) because there is
 * no `TenantContext` at all on this unauthenticated route — see the
 * story plan's Design decision 1.
 */
export class SubmitWebFormTicketDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;
}
