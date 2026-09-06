import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

/**
 * RM-03 — mirrors `ListTicketsQueryDto`'s own `unassigned` field shape for
 * the same reason: `completed` maps onto `completedAt IS NOT NULL`, which
 * a query string cannot express as a real boolean/null equality filter,
 * so it is a validated string literal instead. Always additionally scoped
 * to the caller's own tasks — no `ownerUserId` filter is exposed here at
 * all (see `TasksService.listTasks`).
 */
export class ListTasksQueryDto extends IntersectionType(PaginationQueryDto) {
  @ApiProperty({ required: false, enum: ["true", "false"] })
  @IsOptional()
  @IsIn(["true", "false"])
  completed?: "true" | "false";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  ticketId?: string;
}
