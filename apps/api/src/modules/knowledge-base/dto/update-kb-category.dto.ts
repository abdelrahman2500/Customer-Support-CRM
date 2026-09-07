import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

/** RM-27 — mirrors `UpdateTicketCategoryDto` exactly: rename and/or
 * activate/deactivate. No delete route — see `KnowledgeBaseCategory`'s own
 * schema doc comment for why. */
export class UpdateKbCategoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
