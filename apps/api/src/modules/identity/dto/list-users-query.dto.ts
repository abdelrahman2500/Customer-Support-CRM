import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

/**
 * Batch 4 (UX audit) — mirrors `ListCustomersQueryDto`'s exact shape: a
 * search filter plus the shared `page`/`pageSize` pair. Backs
 * `IdentityService.listUsersPaged`, the real-pagination replacement for the
 * admin Users *screen*'s own `MAX_USERS_ROWS` cap — `listUsers()`/
 * `GET /identity/users` itself is unchanged, since every one of its other
 * callers (assignee pickers, audit-log actor names, chat sender-name
 * lookups, ...) genuinely needs every branch member, not one page of them
 * (mirrors this same file's own `listUserMentionCandidates` precedent for
 * exactly that distinction).
 */
export class ListUsersQueryDto extends IntersectionType(PaginationQueryDto) {
  @ApiProperty({ required: false, description: "Matches fullName or email, case-insensitive." })
  @IsOptional()
  @IsString()
  search?: string;
}
