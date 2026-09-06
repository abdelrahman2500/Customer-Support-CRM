import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

/** Mirrors `CreateTicketNoteDto` exactly. */
export class CreateCustomerNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}
