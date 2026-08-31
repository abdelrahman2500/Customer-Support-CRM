import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

/** Shared by both the agent-facing (`TicketsController`) and
 * customer-facing (`PortalTicketsController`) send-message routes —
 * identical validation, mirroring `CreateTicketNoteDto`'s own shape. */
export class CreateChannelMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}
