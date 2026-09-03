import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/** Story 120 — mirrors `CreateDepartmentDto` exactly. */
export class CreateTicketCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}
