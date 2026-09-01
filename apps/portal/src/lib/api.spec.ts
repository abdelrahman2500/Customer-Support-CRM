import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_COOKIE,
  ApiError,
  apiFetch,
  clearAccessToken,
  getAccessToken,
  logout,
  setAccessToken,
} from "./api";
import { emitAuthExpired } from "./auth-events";

/**
 * Story 95 — mirrors `apps/web/src/lib/api.spec.ts` exactly (retargeted to
 * `/portal/auth/*`); `apps/portal`'s `apiFetch` never previously had its own
 * dedicated spec file — its silent-refresh/logout behavior mirrors
 * `apps/web`'s file-for-file, so this covers it directly for the first time
 * alongside this story's new `emitAuthExpired` wiring.
 */
vi.mock("./auth-events", () => ({
  emitAuthExpired: vi.fn(),
}));

const mockedEmitAuthExpired = vi.mocked(emitAuthExpired);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api.ts (portal) — silent refresh / logout", () => {
  beforeEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
    mockedEmitAuthExpired.mockClear();
  });

  afterEach(() => {
    clearAccessToken();
  });

  describe("apiFetch", () => {
    it("attaches the Bearer token from the access-token cookie", async () => {
      setAccessToken("token-1");
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(200, { ok: true }),
      );

      await apiFetch("/portal/tickets");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0]!;
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
    });

    it("throws a 403 immediately without ever attempting a refresh", async () => {
      setAccessToken("token-1");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(jsonResponse(403, { message: "Forbidden" }));

      await expect(apiFetch("/portal/tickets")).rejects.toMatchObject({ status: 403 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(mockedEmitAuthExpired).not.toHaveBeenCalled();
    });

    it("retries once after a successful silent refresh and resolves with the retried response", async () => {
      setAccessToken("expired-token");
      let ticketCallCount = 0;
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/portal/auth/refresh")) {
          return Promise.resolve(jsonResponse(200, { accessToken: "fresh-token" }));
        }
        ticketCallCount += 1;
        if (ticketCallCount === 1) {
          return Promise.resolve(jsonResponse(401, { message: "Unauthorized" }));
        }
        return Promise.resolve(jsonResponse(200, { id: "ticket-1" }));
      });

      const result = await apiFetch<{ id: string }>("/portal/tickets/ticket-1");

      expect(result).toEqual({ id: "ticket-1" });
      expect(ticketCallCount).toBe(2);
      expect(getAccessToken()).toBe("fresh-token");

      const refreshCall = fetchMock.mock.calls.find(([input]) =>
        String(input).includes("/portal/auth/refresh"),
      );
      expect(refreshCall).toBeDefined();
      expect(refreshCall![1]).toMatchObject({ method: "POST", credentials: "include" });

      const retriedCall = fetchMock.mock.calls.filter(
        ([input]) => !String(input).includes("/portal/auth/refresh"),
      )[1]!;
      expect((retriedCall[1]?.headers as Record<string, string>).Authorization).toBe(
        "Bearer fresh-token",
      );
      expect(mockedEmitAuthExpired).not.toHaveBeenCalled();
    });

    it("clears the access token, emits auth-expired, and throws the original 401 when refresh itself fails", async () => {
      setAccessToken("expired-token");
      vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/portal/auth/refresh")) {
          return Promise.resolve(jsonResponse(401, { message: "Refresh token is invalid or expired" }));
        }
        return Promise.resolve(jsonResponse(401, { message: "Unauthorized" }));
      });

      await expect(apiFetch("/portal/tickets")).rejects.toMatchObject({ status: 401 });
      expect(getAccessToken()).toBeNull();
      // Story 95 — a confirmed-dead session forces AuthRecoveryListener's redirect.
      expect(mockedEmitAuthExpired).toHaveBeenCalledOnce();
    });

    it("clears the access token, emits auth-expired, and throws a 401 when the retried request still 401s after a successful refresh", async () => {
      setAccessToken("expired-token");
      let ticketCallCount = 0;
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/portal/auth/refresh")) {
          return Promise.resolve(jsonResponse(200, { accessToken: "fresh-token" }));
        }
        ticketCallCount += 1;
        return Promise.resolve(jsonResponse(401, { message: "Unauthorized" }));
      });

      await expect(apiFetch("/portal/tickets")).rejects.toMatchObject({ status: 401 });

      expect(getAccessToken()).toBeNull();
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes("/portal/auth/refresh")),
      ).toHaveLength(1);
      expect(ticketCallCount).toBe(2);
      expect(mockedEmitAuthExpired).toHaveBeenCalledOnce();
    });

    it("does not clear the access token, does not emit auth-expired, and throws the retry's own 403 when the retried request is forbidden", async () => {
      setAccessToken("expired-token");
      let ticketCallCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/portal/auth/refresh")) {
          return Promise.resolve(jsonResponse(200, { accessToken: "fresh-token" }));
        }
        ticketCallCount += 1;
        if (ticketCallCount === 1) {
          return Promise.resolve(jsonResponse(401, { message: "Unauthorized" }));
        }
        return Promise.resolve(jsonResponse(403, { message: "Forbidden" }));
      });

      await expect(apiFetch("/portal/tickets")).rejects.toMatchObject({ status: 403 });

      expect(mockedEmitAuthExpired).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("fresh-token");
    });

    it.each([404, 500])(
      "does not clear the access token and propagates the retry's own %i when the retried request fails",
      async (status) => {
        setAccessToken("expired-token");
        let ticketCallCount = 0;
        vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes("/portal/auth/refresh")) {
            return Promise.resolve(jsonResponse(200, { accessToken: "fresh-token" }));
          }
          ticketCallCount += 1;
          if (ticketCallCount === 1) {
            return Promise.resolve(jsonResponse(401, { message: "Unauthorized" }));
          }
          return Promise.resolve(jsonResponse(status, { message: "boom" }));
        });

        await expect(apiFetch("/portal/tickets")).rejects.toMatchObject({ status });

        expect(getAccessToken()).toBe("fresh-token");
      },
    );

    it("de-duplicates concurrent 401s into exactly one real refresh call", async () => {
      setAccessToken("expired-token");
      let refreshCallCount = 0;
      const requestCounts: Record<string, number> = {};
      vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/portal/auth/refresh")) {
          refreshCallCount += 1;
          return Promise.resolve(jsonResponse(200, { accessToken: "fresh-token" }));
        }
        const key = url;
        requestCounts[key] = (requestCounts[key] ?? 0) + 1;
        if (requestCounts[key] === 1) {
          return Promise.resolve(jsonResponse(401, { message: "Unauthorized" }));
        }
        return Promise.resolve(jsonResponse(200, { ok: true }));
      });

      await Promise.all([
        apiFetch("/portal/tickets"),
        apiFetch("/portal/knowledge-base"),
        apiFetch("/portal/notifications"),
      ]);

      expect(refreshCallCount).toBe(1);
    });
  });

  describe("logout", () => {
    it("calls the real POST /portal/auth/logout with credentials included", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

      await logout();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(String(url)).toContain("/portal/auth/logout");
      expect(init).toMatchObject({ method: "POST", credentials: "include" });
    });

    it("does not throw when the logout request fails (best-effort)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

      await expect(logout()).resolves.toBeUndefined();
    });

    it("does not throw when the logout request resolves with a non-2xx status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(500, { message: "boom" }));

      await expect(logout()).resolves.toBeUndefined();
    });
  });

  describe("setAccessToken / ACCESS_TOKEN_COOKIE", () => {
    it("writes the same cookie shape the login page relies on, under the portal's own cookie name", () => {
      setAccessToken("a-token");
      expect(ACCESS_TOKEN_COOKIE).toBe("crm_portal_access_token");
      expect(document.cookie).toContain(`${ACCESS_TOKEN_COOKIE}=a-token`);
      expect(getAccessToken()).toBe("a-token");
    });
  });
});

describe("api.ts (portal) — ApiError", () => {
  it("carries the real HTTP status", () => {
    const error = new ApiError("boom", 500);
    expect(error.status).toBe(500);
    expect(error.message).toBe("boom");
  });
});
