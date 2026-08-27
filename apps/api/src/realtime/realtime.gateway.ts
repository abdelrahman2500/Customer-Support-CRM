import { Injectable, Logger } from "@nestjs/common";
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

/** Per-socket data bag — the Socket.IO analogue of `TenantContext`'s claims. */
export interface RealtimeSocketData {
  claims: TenantClaims;
}

/**
 * Reuses `JwtService.verify()` exactly like `TenantMiddleware`
 * (see docs comment there) — Design item 1. No CORS is configured — Design
 * item 6. Default namespace (`/`); no architecture text specifies a
 * dedicated one.
 */
@Injectable()
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

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
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
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
      return presenceMatch[1] === claims.userId;
    }

    return false;
  }
}
