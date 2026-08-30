import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

/**
 * Story 64 — the first search-query-param precedent anywhere in this
 * codebase (`ListTicketsQueryDto`'s own doc comment explicitly deferred
 * search as out of scope for Story 23). Matches `title`/`body` via a plain
 * `contains`/`mode: "insensitive"` filter, not `tsvector` — see
 * `knowledge-base.service.ts`'s own doc comment for why.
 */
export class ListArticlesQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;
}
