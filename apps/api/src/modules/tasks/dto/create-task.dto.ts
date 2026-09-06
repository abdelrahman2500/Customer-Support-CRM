import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { TaskPriority } from "@prisma/client";

/**
 * RM-03 — a task is always created for the caller's own account:
 * `ownerUserId` is never accepted here (resolved server-side from
 * `TenantContext`, mirroring `submitCsat`/every other "this is always the
 * authenticated caller's own" convention in this codebase) — the one
 * concrete way this DTO closes off privilege escalation through an
 * arbitrary owner/assignee id.
 */
export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ required: false, enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /** Validated in-scope by `TasksService` via the existing
   * `TicketsService.getTicket` (throws `NotFoundException` for a ticket
   * outside the caller's branch/department scope) — never re-derived
   * here. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  /** Same in-scope validation via `CustomersService.getCustomer`. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  /** Doubles as the reminder time — see `Task`'s own schema doc comment
   * for why there is no separate `reminderAt` field. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
