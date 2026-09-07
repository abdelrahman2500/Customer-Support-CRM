import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import type { Paginated } from "../../common/pagination/paginated";
import { WebhookVerifierRegistry } from "./webhook-verifier";
import type { ListWebhookInboundLogsQueryDto } from "./dto/list-webhook-inbound-logs-query.dto";

export interface WebhookInboundLogSummary {
  id: string;
  providerKey: string;
  verified: boolean;
  rejectReason: string | null;
  headers: unknown;
  body: string;
  receivedAt: Date;
}

/** `IncomingHttpHeaders` values are `string | string[] | undefined` —
 * `undefined` isn't valid JSON, so a header Node never actually set (an
 * absent optional header) must be dropped, not stored as `null`/omitted
 * inconsistently, before this can be written to a `Json` column. */
function toJsonSafeHeaders(headers: IncomingHttpHeaders): Prisma.InputJsonValue {
  const safe: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * RM-21 — Inbound Webhook Receiver + Signature Verification Framework.
 * `receive()` is this story's entire synchronous contract: resolve a
 * verifier for `providerKey` (or treat an unrecognized key as an
 * automatic rejection), write exactly one `WebhookInboundLog` row
 * regardless of outcome, then throw for the controller to turn into a
 * 401 if verification failed. No further processing (translating a
 * verified payload into a `ChannelMessage`/domain event) happens here —
 * that is explicitly deferred to whichever future provider-specific
 * story registers a real verifier (this story's own disclosed
 * non-goal).
 */
@Injectable()
export class WebhookInboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verifierRegistry: WebhookVerifierRegistry,
  ) {}

  async receive(providerKey: string, rawBody: Buffer, headers: IncomingHttpHeaders): Promise<void> {
    const verifier = this.verifierRegistry.resolve(providerKey);
    const result = verifier
      ? verifier.verify(rawBody, headers)
      : { verified: false, rejectReason: `No verifier registered for provider "${providerKey}"` };

    await this.prisma.webhookInboundLog.create({
      data: {
        providerKey,
        verified: result.verified,
        rejectReason: result.rejectReason ?? null,
        headers: toJsonSafeHeaders(headers),
        body: rawBody.toString("utf8"),
      },
    });

    if (!result.verified) {
      throw new UnauthorizedException(result.rejectReason ?? "Webhook verification failed");
    }
  }

  /** Admin visibility over every received payload — deliberately global,
   * not branch-scoped: see `WebhookInboundLog`'s own schema doc comment
   * for why no tenant scope exists to filter by yet. */
  async listLogs(
    query: ListWebhookInboundLogsQueryDto = {},
  ): Promise<Paginated<WebhookInboundLogSummary>> {
    const { items: logs, ...pagination } = await paginate(this.prisma.webhookInboundLog, {
      where: {},
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      ...pagination,
      items: logs.map((log) => ({
        id: log.id,
        providerKey: log.providerKey,
        verified: log.verified,
        rejectReason: log.rejectReason,
        headers: log.headers,
        body: log.body,
        receivedAt: log.receivedAt,
      })),
    };
  }
}
