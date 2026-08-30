import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { TenantClaims } from "../common/tenant/tenant-context";
import type { EnvConfig } from "../common/config/env.validation";
import { PresenceService } from "./presence.service";

/** Per-socket data bag — the Socket.IO analogue of `TenantContext`'s claims. */
export interface RealtimeSocketData {
  claims: TenantClaims;
}

/** Story 71 — the room this event is emitted into is always
 * `agent:{userId}:presence`. */
export const AGENT_PRESENCE_CHANGED_EVENT = "agent.presence.changed";

export interface AgentPresenceChangedPayload {
  userId: string;
  status: "online" | "offline";
}

/**
 * Reuses `JwtService.verify()` exactly like `TenantMiddleware`
 * (see docs comment there) — Design item 1. No CORS is configured — Design
 * item 6. Default namespace (`/`); no architecture text specifies a
 * dedicated one.
 *
 * Story 71 — Agent Presence, see docs/architecture/06-communication-and-
 * realtime.md ("agent presence") and its own `agent:{id}:presence` room,
 * which this gateway's `authorizeRoom` already anticipated but never
 * finished. Presence must be observable by any authenticated agent in the
 * *same branch* as the agent being watched, never cross-branch — so
 * `authorizeRoom`'s presence case is broadened from "only the caller's own
 * id" to "the caller's own id, or any id the caller shares an active
 * `UserBranchRole` branch membership with" (a real DB lookup, mirroring
 * the exact pattern `ticketMatch`'s own branch check already uses). A
 * fresh joiner is immediately told the current status (not left waiting
 * for a future transition) via `sendCurrentPresence`.
 *
 * `OnModuleDestroy` tracks every currently-open socket's `(socketId,
 * userId)` pair locally (`connectedSockets`) and, on graceful shutdown,
 * explicitly records a disconnect for each one *before* returning —
 * guaranteed (Nest's documented lifecycle: every provider's
 * `onModuleDestroy` completes before any `onApplicationShutdown` runs) to
 * finish before `PresenceService.onApplicationShutdown` closes the Redis
 * connection this all depends on. Without this, a socket disconnecting
 * while `app.close()` is already tearing the module down races the Redis
 * client's own shutdown — the in-flight `SREM` can lose, permanently
 * leaving a stale "online" entry behind (caught during this Story's own
 * e2e verification against real Redis, not a theoretical concern).
 */
@Injectable()
@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly connectedSockets = new Map<string, string>(); // socketId -> userId

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    const remaining = [...this.connectedSockets.entries()];
    this.connectedSockets.clear();
    await Promise.all(
      remaining.map(([socketId, userId]) => this.trackDisconnect(userId, socketId)),
    );
  }

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }

    let claims: JwtAccessTokenClaims;
    try {
      claims = this.jwtService.verify<JwtAccessTokenClaims>(token, {
        secret: this.configService.get("JWT_ACCESS_SECRET", { infer: true }),
      });
    } catch {
      client.disconnect(true);
      return;
    }

    if (claims.audience !== "agent") {
      client.disconnect(true);
      return;
    }

    (client.data as RealtimeSocketData).claims = {
      userId: claims.sub,
      branchId: claims.branchId,
      departmentId: claims.departmentId,
      roles: claims.roles,
    };
    this.connectedSockets.set(client.id, claims.sub);
    void this.trackConnect(claims.sub, client.id);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
    this.connectedSockets.delete(client.id);
    const claims = (client.data as Partial<RealtimeSocketData>).claims;
    if (claims) {
      void this.trackDisconnect(claims.userId, client.id);
    }
  }

  @SubscribeMessage("join")
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room?: unknown },
  ): Promise<{ ok: boolean }> {
    const claims = (client.data as Partial<RealtimeSocketData>).claims;
    const room = typeof body?.room === "string" ? body.room : undefined;
    if (!claims || !room || !(await this.authorizeRoom(claims, room))) {
      return { ok: false };
    }
    await client.join(room);
    await this.sendCurrentPresenceIfApplicable(client, room);
    return { ok: true };
  }

  private async authorizeRoom(claims: TenantClaims, room: string): Promise<boolean> {
    const ticketMatch = /^ticket:(.+)$/.exec(room);
    if (ticketMatch) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketMatch[1] },
        select: { branchId: true },
      });
      return ticket !== null && ticket.branchId === claims.branchId;
    }

    const branchMatch = /^branch:(.+):notifications$/.exec(room);
    if (branchMatch) {
      return claims.branchId !== null && branchMatch[1] === claims.branchId;
    }

    const presenceMatch = /^agent:(.+):presence$/.exec(room);
    if (presenceMatch) {
      const targetUserId = presenceMatch[1] as string;
      if (targetUserId === claims.userId) {
        return true;
      }
      if (!claims.branchId) {
        return false;
      }
      const membership = await this.prisma.userBranchRole.findFirst({
        where: { userId: targetUserId, branchId: claims.branchId },
        select: { id: true },
      });
      return membership !== null;
    }

    return false;
  }

  private async trackConnect(userId: string, socketId: string): Promise<void> {
    try {
      const wentOnline = await this.presenceService.recordConnect(userId, socketId);
      if (wentOnline) {
        this.emitPresence(userId, "online");
      }
    } catch (error) {
      this.logger.error(`Failed to record presence connect for ${userId}`, error as Error);
    }
  }

  private async trackDisconnect(userId: string, socketId: string): Promise<void> {
    try {
      const wentOffline = await this.presenceService.recordDisconnect(userId, socketId);
      if (wentOffline) {
        this.emitPresence(userId, "offline");
      }
    } catch (error) {
      this.logger.error(`Failed to record presence disconnect for ${userId}`, error as Error);
    }
  }

  /** A fresh joiner to `agent:{id}:presence` is told the current status
   * directly (`client.emit`, not a room broadcast) — they'd otherwise wait
   * indefinitely for a future transition that may never come. */
  private async sendCurrentPresenceIfApplicable(client: Socket, room: string): Promise<void> {
    const presenceMatch = /^agent:(.+):presence$/.exec(room);
    if (!presenceMatch) {
      return;
    }
    const userId = presenceMatch[1] as string;
    try {
      const online = await this.presenceService.isOnline(userId);
      client.emit(AGENT_PRESENCE_CHANGED_EVENT, {
        userId,
        status: online ? "online" : "offline",
      } satisfies AgentPresenceChangedPayload);
    } catch (error) {
      this.logger.error(`Failed to send current presence for ${userId}`, error as Error);
    }
  }

  private emitPresence(userId: string, status: "online" | "offline"): void {
    this.server
      .to(`agent:${userId}:presence`)
      .emit(AGENT_PRESENCE_CHANGED_EVENT, { userId, status } satisfies AgentPresenceChangedPayload);
  }
}
