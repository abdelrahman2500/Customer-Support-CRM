import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, enum: KnowledgeBaseArticleStatus })
  @IsOptional()
  @IsEnum(KnowledgeBaseArticleStatus)
  status?: KnowledgeBaseArticleStatus;
}
