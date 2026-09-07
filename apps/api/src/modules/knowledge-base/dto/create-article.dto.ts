import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateArticleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;

  /** RM-27 — `category` (free text) replaced by `categoryId` (exact-id
   * reference into `KnowledgeBaseCategory`), mirroring
   * `CreateTicketDto.categoryId`'s own schema change. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
