import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

/** Story 120 — mirrors `UpdateDepartmentDto` exactly: rename and/or
 * activate/deactivate. No delete route — see `TicketCategory`'s own
 * schema doc comment for why. */
export class UpdateTicketCategoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
