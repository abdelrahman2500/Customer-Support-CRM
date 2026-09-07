import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../env.validation";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { ChannelAdapterRegistry } from "./channel-adapter-registry";
import { EMAIL_ADAPTER } from "./channels.constants";
import { EmailAdapter } from "./email-adapter";
import { FirstPartyChannelAdapter } from "./first-party-channel-adapter";

/**
 * RM-14 — Channel Adapter Interface + Registry. Mirrors `AiProviderModule`'s
 * own minimal shape: exports the one thing a consumer (RM-13's
 * `ChannelMessageDeliveryProcessor`) needs, registers this module in
 * `WorkerModule` so Nest actually constructs it at boot.
 *
 * RM-15 — the `EMAIL_ADAPTER` factory is the one place that decides
 * whether a real `EmailAdapter` gets constructed at all: both `SMTP_HOST`
 * and `SMTP_FROM` must be present, otherwise it returns `undefined` —
 * `@Optional()` on `ChannelAdapterRegistry`'s own constructor accepts
 * that, and `resolve("EMAIL")` then correctly reports "no adapter
 * configured", exactly RM-14's own existing graceful-absence behavior
 * for `WHATSAPP`/`SMS`. This is what keeps production email delivery
 * "disabled by configuration" until a real SMTP relay decision is made
 * (`02-product-decisions.md` Decision Record 1) — no code branches on
 * `NODE_ENV`, only on whether the two env vars are actually set.
 * `PrismaModule` is imported directly (rather than assumed already
 * present) so this module is safe to test/compile in isolation.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    FirstPartyChannelAdapter,
    {
      provide: EMAIL_ADAPTER,
      useFactory: (prisma: PrismaService, config: ConfigService<EnvConfig, true>) => {
        const host = config.get("SMTP_HOST", { infer: true });
        const from = config.get("SMTP_FROM", { infer: true });
        if (!host || !from) {
          return undefined;
        }
        return new EmailAdapter(prisma, {
          host,
          port: config.get("SMTP_PORT", { infer: true }),
          user: config.get("SMTP_USER", { infer: true }),
          password: config.get("SMTP_PASSWORD", { infer: true }),
          from,
        });
      },
      inject: [PrismaService, ConfigService],
    },
    ChannelAdapterRegistry,
  ],
  exports: [ChannelAdapterRegistry],
})
export class ChannelsModule {}
