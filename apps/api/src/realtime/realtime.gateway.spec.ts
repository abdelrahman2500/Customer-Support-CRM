import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { RealtimeGateway } from "./realtime.gateway";
import type { RealtimeSocketData } from "./realtime.gateway";
import type { EnvConfig } from "../common/config/env.validation";
import type { PrismaService } from "../prisma/prisma.service";

function buildJwtServiceMock() {
  return { verify: vi.fn() };
}

function buildConfigServiceMock() {
  return { get: vi.fn().mockReturnValue("dev-only-access-secret-change-me-please-32chars-min") };
}

function buildPrismaMock() {
  return { ticket: { findUnique: vi.fn() } };
}

function buildSocketMock(overrides: { token?: string } = {}) {
  return {
    id: "socket-1",
    handshake: { auth: overrides.token !== undefined ? { token: overrides.token } : {} },
    data: {} as Partial<RealtimeSocketData>,
    disconnect: vi.fn(),
    join: vi.fn(),
  };
}

function createGateway(
  jwtMock: ReturnType<typeof buildJwtServiceMock>,
  configMock: ReturnType<typeof buildConfigServiceMock>,
  prismaMock: ReturnType<typeof buildPrismaMock>,
): RealtimeGateway {
  return new RealtimeGateway(
    jwtMock as unknown as JwtService,
    configMock as unknown as ConfigService<EnvConfig, true>,
    prismaMock as unknown as PrismaService,
  );
}

const agentClaims = {
  sub: "user-1",
  audience: "agent" as const,
  branchId: "branch-1",
  departmentId: "dept-1",
  roles: ["agent"],
};

describe("RealtimeGateway", () => {
  let jwt: ReturnType<typeof buildJwtServiceMock>;
  let config: ReturnType<typeof buildConfigServiceMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let gateway: RealtimeGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    jwt = buildJwtServiceMock();
    config = buildConfigServiceMock();
    prisma = buildPrismaMock();
    gateway = createGateway(jwt, config, prisma);
  });

  describe("handleConnection", () => {
    it("disconnects a socket with no token", () => {
      const client = buildSocketMock();

      gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    it("disconnects a socket whose token fails verification (invalid/expired/malformed)", () => {
      const client = buildSocketMock({ token: "bad-token" });
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it("disconnects a socket whose token has a non-agent audience", () => {
      const client = buildSocketMock({ token: "customer-token" });
      jwt.verify.mockReturnValue({ ...agentClaims, audience: "customer" });

      gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it("populates client.data.claims for a valid agent-audience token, without disconnecting", () => {
      const client = buildSocketMock({ token: "good-token" });
      jwt.verify.mockReturnValue(agentClaims);

      gateway.handleConnection(client as never);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data).toEqual({
        claims: { userId: "user-1", branchId: "branch-1", departmentId: "dept-1", roles: ["agent"] },
      });
    });
  });

  describe("onJoin / authorizeRoom", () => {
    function connectedClient(): ReturnType<typeof buildSocketMock> {
      const client = buildSocketMock({ token: "good-token" });
      jwt.verify.mockReturnValue(agentClaims);
      gateway.handleConnection(client as never);
      return client;
    }

    it("allows joining ticket:{id} when the ticket belongs to the caller's own branch", async () => {
      const client = connectedClient();
      prisma.ticket.findUnique.mockResolvedValue({ branchId: "branch-1" });

      const result = await gateway.onJoin(client as never, { room: "ticket:ticket-1" });

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        select: { branchId: true },
      });
      expect(result).toEqual({ ok: true });
      expect(client.join).toHaveBeenCalledWith("ticket:ticket-1");
    });

    it("denies joining ticket:{id} when the ticket belongs to a different branch", async () => {
      const client = connectedClient();
      prisma.ticket.findUnique.mockResolvedValue({ branchId: "branch-2" });

      const result = await gateway.onJoin(client as never, { room: "ticket:ticket-1" });

      expect(result).toEqual({ ok: false });
      expect(client.join).not.toHaveBeenCalled();
    });

    it("denies joining ticket:{id} when the ticket does not exist", async () => {
      const client = connectedClient();
      prisma.ticket.findUnique.mockResolvedValue(null);

      const result = await gateway.onJoin(client as never, { room: "ticket:missing" });

      expect(result).toEqual({ ok: false });
    });

    it("allows joining branch:{id}:notifications only for the caller's own branch", async () => {
      const client = connectedClient();

      const own = await gateway.onJoin(client as never, { room: "branch:branch-1:notifications" });
      const other = await gateway.onJoin(client as never, { room: "branch:branch-2:notifications" });

      expect(own).toEqual({ ok: true });
      expect(other).toEqual({ ok: false });
    });

    it("allows joining agent:{id}:presence only for the caller's own id", async () => {
      const client = connectedClient();

      const own = await gateway.onJoin(client as never, { room: "agent:user-1:presence" });
      const other = await gateway.onJoin(client as never, { room: "agent:user-2:presence" });

      expect(own).toEqual({ ok: true });
      expect(other).toEqual({ ok: false });
    });

    it("denies an unrecognized room shape by default", async () => {
      const client = connectedClient();

      const result = await gateway.onJoin(client as never, { room: "something-else:1" });

      expect(result).toEqual({ ok: false });
    });

    it("denies a join when the socket has no claims (never authenticated)", async () => {
      const client = buildSocketMock({ token: "good-token" }); // handleConnection deliberately not called

      const result = await gateway.onJoin(client as never, { room: "agent:user-1:presence" });

      expect(result).toEqual({ ok: false });
    });

    it("denies a join whose room field is not a string", async () => {
      const client = connectedClient();

      const result = await gateway.onJoin(client as never, { room: 42 });

      expect(result).toEqual({ ok: false });
    });
  });
});
