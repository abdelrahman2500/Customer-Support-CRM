import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/** RM-27 — mirrors `CreateTicketCategoryDto` exactly. */
export class CreateKbCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}
