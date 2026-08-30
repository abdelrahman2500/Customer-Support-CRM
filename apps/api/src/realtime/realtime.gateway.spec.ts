import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { RealtimeGateway } from "./realtime.gateway";
import type { RealtimeSocketData } from "./realtime.gateway";
import type { EnvConfig } from "../common/config/env.validation";
import type { PrismaService } from "../prisma/prisma.service";
import type { PresenceService } from "./presence.service";

function buildJwtServiceMock() {
  return { verify: vi.fn() };
}

function buildConfigServiceMock() {
  return { get: vi.fn().mockReturnValue("dev-only-access-secret-change-me-please-32chars-min") };
}

function buildPrismaMock() {
  return {
    ticket: { findUnique: vi.fn() },
    userBranchRole: { findFirst: vi.fn() },
  };
}

// Story 71 — Agent Presence.
function buildPresenceServiceMock() {
  return {
    recordConnect: vi.fn().mockResolvedValue(false),
    recordDisconnect: vi.fn().mockResolvedValue(false),
    isOnline: vi.fn().mockResolvedValue(false),
  };
}

function buildSocketMock(overrides: { token?: string } = {}) {
  return {
    id: "socket-1",
    handshake: { auth: overrides.token !== undefined ? { token: overrides.token } : {} },
    data: {} as Partial<RealtimeSocketData>,
    disconnect: vi.fn(),
    join: vi.fn(),
    emit: vi.fn(),
  };
}

function createGateway(
  jwtMock: ReturnType<typeof buildJwtServiceMock>,
  configMock: ReturnType<typeof buildConfigServiceMock>,
  prismaMock: ReturnType<typeof buildPrismaMock>,
  presenceMock: ReturnType<typeof buildPresenceServiceMock>,
): RealtimeGateway {
  return new RealtimeGateway(
    jwtMock as unknown as JwtService,
    configMock as unknown as ConfigService<EnvConfig, true>,
    prismaMock as unknown as PrismaService,
    presenceMock as unknown as PresenceService,
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
  let presence: ReturnType<typeof buildPresenceServiceMock>;
  let gateway: RealtimeGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    jwt = buildJwtServiceMock();
    config = buildConfigServiceMock();
    prisma = buildPrismaMock();
    presence = buildPresenceServiceMock();
    gateway = createGateway(jwt, config, prisma, presence);
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

    // Story 71 — Agent Presence.
    it("records a presence connect and broadcasts online only on a real (first-connection) transition", async () => {
      const client = buildSocketMock({ token: "good-token" });
      jwt.verify.mockReturnValue(agentClaims);
      presence.recordConnect.mockResolvedValue(true);
      const emitSpy = vi.fn().mockReturnValue({ emit: vi.fn() });
      (gateway as unknown as { server: unknown }).server = { to: emitSpy };

      gateway.handleConnection(client as never);
      await vi.waitFor(() => expect(presence.recordConnect).toHaveBeenCalledWith("user-1", "socket-1"));

      expect(emitSpy).toHaveBeenCalledWith("agent:user-1:presence");
    });

    it("does not broadcast when the connection is not a real transition (e.g. a second tab)", async () => {
      const client = buildSocketMock({ token: "good-token" });
      jwt.verify.mockReturnValue(agentClaims);
      presence.recordConnect.mockResolvedValue(false);
      const emitSpy = vi.fn();
      (gateway as unknown as { server: unknown }).server = { to: emitSpy };

      gateway.handleConnection(client as never);
      await vi.waitFor(() => expect(presence.recordConnect).toHaveBeenCalled());

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe("handleDisconnect", () => {
    it("does nothing when the socket was never authenticated (no claims)", async () => {
      const client = buildSocketMock();

      gateway.handleDisconnect(client as never);
      await Promise.resolve();

      expect(presence.recordDisconnect).not.toHaveBeenCalled();
    });

    it("records a presence disconnect and broadcasts offline only on a real (last-connection) transition", async () => {
      const client = buildSocketMock({ token: "good-token" });
      jwt.verify.mockReturnValue(agentClaims);
      gateway.handleConnection(client as never);
      presence.recordDisconnect.mockResolvedValue(true);
      const emitSpy = vi.fn().mockReturnValue({ emit: vi.fn() });
      (gateway as unknown as { server: unknown }).server = { to: emitSpy };

      gateway.handleDisconnect(client as never);
      await vi.waitFor(() =>
        expect(presence.recordDisconnect).toHaveBeenCalledWith("user-1", "socket-1"),
      );

      expect(emitSpy).toHaveBeenCalledWith("agent:user-1:presence");
    });

    it("does not broadcast when another tab/device is still connected", async () => {
      const client = buildSocketMock({ token: "good-token" });
      jwt.verify.mockReturnValue(agentClaims);
      gateway.handleConnection(client as never);
      presence.recordDisconnect.mockResolvedValue(false);
      const emitSpy = vi.fn();
      (gateway as unknown as { server: unknown }).server = { to: emitSpy };

      gateway.handleDisconnect(client as never);
      await vi.waitFor(() => expect(presence.recordDisconnect).toHaveBeenCalled());

      expect(emitSpy).not.toHaveBeenCalled();
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

    // Story 71 — Agent Presence deliberately broadens this room's
    // authorization: presence must be *observable* by someone other than
    // the agent themselves (a colleague watching their status), while
    // never crossing branches. This intentionally supersedes the
    // pre-Story-71 "only the caller's own id" rule this test used to
    // assert — the new rule is "own id, or any id sharing an active
    // `UserBranchRole` branch membership with the caller."
    it("always allows joining the caller's own agent:{id}:presence room", async () => {
      const client = connectedClient();

      const result = await gateway.onJoin(client as never, { room: "agent:user-1:presence" });

      expect(result).toEqual({ ok: true });
      expect(prisma.userBranchRole.findFirst).not.toHaveBeenCalled();
    });

    it("allows joining another agent's presence room when they share the caller's branch", async () => {
      const client = connectedClient();
      prisma.userBranchRole.findFirst.mockResolvedValue({ id: "membership-1" });

      const result = await gateway.onJoin(client as never, { room: "agent:user-2:presence" });

      expect(prisma.userBranchRole.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-2", branchId: "branch-1" },
        select: { id: true },
      });
      expect(result).toEqual({ ok: true });
    });

    it("denies joining another agent's presence room when they don't share the caller's branch", async () => {
      const client = connectedClient();
      prisma.userBranchRole.findFirst.mockResolvedValue(null);

      const result = await gateway.onJoin(client as never, { room: "agent:user-2:presence" });

      expect(result).toEqual({ ok: false });
    });

    it("sends the current presence status to a client that just joined a presence room", async () => {
      const client = connectedClient();
      presence.isOnline.mockResolvedValue(true);

      await gateway.onJoin(client as never, { room: "agent:user-1:presence" });

      expect(presence.isOnline).toHaveBeenCalledWith("user-1");
      expect(client.emit).toHaveBeenCalledWith("agent.presence.changed", {
        userId: "user-1",
        status: "online",
      });
    });

    it("does not send a presence status when joining a non-presence room", async () => {
      const client = connectedClient();

      await gateway.onJoin(client as never, { room: "branch:branch-1:notifications" });

      expect(presence.isOnline).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
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
