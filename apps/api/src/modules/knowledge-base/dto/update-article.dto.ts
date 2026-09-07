import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { KnowledgeBaseArticleStatus } from "@prisma/client";

export class UpdateArticleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  /** RM-27 — `category` (free text) replaced by `categoryId` (exact-id
   * reference into `KnowledgeBaseCategory`), mirroring
   * `UpdateTicketDto.categoryId`'s own schema change. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ required: false, enum: KnowledgeBaseArticleStatus })
  @IsOptional()
  @IsEnum(KnowledgeBaseArticleStatus)
  status?: KnowledgeBaseArticleStatus;
}
