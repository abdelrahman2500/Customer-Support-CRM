import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/auth/public.decorator";
import { SubmitWebFormTicketDto } from "./dto/submit-web-form-ticket.dto";
import { WebFormIntakeService } from "./web-form-intake.service";
import type { TicketSummary } from "./tickets.service";

/**
 * Story 87 — Communication/Channels: Public Web-Form Ticket Intake. The
 * route is named for the domain it belongs to (`channels/web-form`),
 * independent of this controller living in `TicketsModule` — the same way
 * `PortalModule`'s controllers already live under `portal/*` routes while
 * composing services from several other modules (see `ChannelsModule`'s
 * own doc comment: "ticket-scoped orchestration... lives in
 * `TicketsModule`").
 *
 * `@Public()` — no JWT at all is expected on this route (unlike every
 * other write endpoint in the API). `@Throttle` overrides the global
 * default (`100`/`60_000`, `app.module.ts`) with a tighter, route-specific
 * limit — the first such override in the codebase, justified by this
 * being the first fully anonymous, unauthenticated *write* endpoint.
 */
@ApiTags("channels")
@Controller("channels/web-form")
export class WebFormIntakeController {
  constructor(private readonly webFormIntakeService: WebFormIntakeService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  submit(@Body() dto: SubmitWebFormTicketDto): Promise<TicketSummary> {
    return this.webFormIntakeService.submit(dto);
  }
}
