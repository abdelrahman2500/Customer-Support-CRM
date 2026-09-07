import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../common/config/env.validation";

export interface EmailChannelStatus {
  configured: boolean;
}

/**
 * RM-15 — a read-only capability signal, not a settings resource: no
 * `@RequirePermissions` (ordinary auth only, mirrors `GET auth/me`'s own
 * "personal/informational, no extra permission" precedent) — every
 * authenticated agent can check whether outbound email is set up.
 * Reports on `SMTP_HOST`/`SMTP_FROM` alone (see `env.validation.ts`'s own
 * doc comment on why only those two are duplicated from `apps/worker`'s
 * copy) — never returns the values themselves, only whether both are
 * present. `TicketChatCard` reads this to decide whether to offer a
 * "send by email" action at all, so it never offers one that would just
 * sit `PENDING` forever.
 */
@ApiTags("channels")
@ApiBearerAuth()
@Controller("channels")
export class EmailStatusController {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  @Get("email-status")
  getEmailStatus(): EmailChannelStatus {
    const host = this.configService.get("SMTP_HOST", { infer: true });
    const from = this.configService.get("SMTP_FROM", { infer: true });
    return { configured: Boolean(host && from) };
  }
}
