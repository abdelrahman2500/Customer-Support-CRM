import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class UpdateNotificationTemplateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  template!: string;
}
