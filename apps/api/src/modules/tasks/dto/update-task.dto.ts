import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { TaskPriority } from "@prisma/client";

/**
 * RM-03 — every field optional (a `PATCH` only ever touches what it
 * explicitly sends, mirroring `UpdateAiSettingsDto`'s own precedent).
 *
 * `ticketId`/`customerId`/`dueAt` each accept `null` as well as their
 * usual type — `@IsOptional()` already lets `null` bypass the validator
 * that follows it, exactly like `undefined` does — so a caller can
 * explicitly clear an association or a due date, not just set one.
 *
 * `completed` is a boolean flag, never a raw `completedAt` timestamp:
 * the server always decides that moment itself (`TasksService` sets/
 * clears `completedAt` to `now()`/`null`), mirroring how `Ticket.resolvedAt`
 * is likewise never client-supplied directly.
 */
export class UpdateTaskDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiProperty({ required: false, enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  ticketId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsISO8601()
  dueAt?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
