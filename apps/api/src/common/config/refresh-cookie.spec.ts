import { describe, expect, it } from "vitest";
import { buildRefreshCookieOptions } from "./refresh-cookie";

describe("buildRefreshCookieOptions", () => {
  it("reproduces the previously hard-coded attributes by default", () => {
    expect(
      buildRefreshCookieOptions({
        nodeEnv: "development",
        sameSite: "strict",
        refreshTtlDays: 7,
        path: "/api/v1/auth",
      }),
    ).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it("marks the cookie Secure in production", () => {
    expect(
      buildRefreshCookieOptions({
        nodeEnv: "production",
        sameSite: "strict",
        refreshTtlDays: 7,
        path: "/api/v1/auth",
      }).secure,
    ).toBe(true);
  });

  it("carries SameSite=none through for a cross-site deployment", () => {
    const options = buildRefreshCookieOptions({
      nodeEnv: "production",
      sameSite: "none",
      refreshTtlDays: 30,
      path: "/api/v1/portal/auth",
    });
    // Browsers only accept SameSite=None together with Secure — the two must
    // always be emitted as a pair, which `env.validation.ts` enforces by
    // refusing `none` outside production.
    expect(options.sameSite).toBe("none");
    expect(options.secure).toBe(true);
  });

  it("keeps the cookie httpOnly and path-scoped for every configuration", () => {
    for (const sameSite of ["strict", "lax", "none"] as const) {
      const options = buildRefreshCookieOptions({
        nodeEnv: "production",
        sameSite,
        refreshTtlDays: 1,
        path: "/api/v1/portal/auth",
      });
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe("/api/v1/portal/auth");
    }
  });

  it("converts the TTL from days to milliseconds", () => {
    expect(
      buildRefreshCookieOptions({
        nodeEnv: "test",
        sameSite: "lax",
        refreshTtlDays: 30,
        path: "/api/v1/auth",
      }).maxAge,
    ).toBe(2_592_000_000);
  });
});
