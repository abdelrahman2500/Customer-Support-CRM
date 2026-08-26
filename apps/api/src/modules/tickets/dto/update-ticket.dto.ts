import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { TicketPriority, TicketStatus } from "@prisma/client";

export class UpdateTicketDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ required: false, enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}
