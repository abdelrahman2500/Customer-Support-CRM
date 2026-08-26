import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { TicketPriority } from "@prisma/client";

export class CreateSlaPolicyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty()
  @IsInt()
  @Min(1)
  responseTargetMinutes!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  resolutionTargetMinutes!: number;
}
