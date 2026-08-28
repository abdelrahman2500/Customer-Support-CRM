import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class SetRolePermissionsDto {
  // Full-replace semantics: the complete desired set of permission keys for
  // the role. Intentionally no `@ArrayNotEmpty()` — an empty array is a
  // valid request that revokes every permission from the role.
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}
