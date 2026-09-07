import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

/** RM-05 — the article to attach; validated as PUBLISHED and in the
 * caller's own branch scope by `TicketKbReferencesService`, not here. */
export class CreateTicketKbReferenceDto {
  @ApiProperty()
  @IsUUID()
  articleId!: string;
}
