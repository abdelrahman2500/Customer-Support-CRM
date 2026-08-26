import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  displayName!: string;
}
