import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { classifyError, resolveErrorMessage } from "./error-message";

const copy = {
  forbidden: "You don't have permission to do that.",
  generic: "Something went wrong.",
  network: "Couldn't reach the server.",
  unauthorized: "Your session has expired.",
};

describe("classifyError", () => {
  it("classifies a 403 as forbidden", () => {
    expect(classifyError(new ApiError("Forbidden", 403))).toEqual({ kind: "forbidden" });
  });

  it("classifies a 401 as unauthorized", () => {
    expect(classifyError(new ApiError("Unauthorized", 401))).toEqual({ kind: "unauthorized" });
  });

  it.each([400, 404, 409, 422])(
    "classifies a %i as validation, preserving the backend message",
    (status) => {
      expect(classifyError(new ApiError("Ticket not found", status))).toEqual({
        kind: "validation",
        message: "Ticket not found",
      });
    },
  );

  it("classifies a 500 as generic, never surfacing the raw backend message", () => {
    expect(classifyError(new ApiError("Internal server error stack trace...", 500))).toEqual({
      kind: "generic",
    });
  });

  it("classifies a non-ApiError (network failure) as network", () => {
    expect(classifyError(new TypeError("Failed to fetch"))).toEqual({ kind: "network" });
    expect(classifyError(null)).toEqual({ kind: "network" });
  });
});

describe("resolveErrorMessage", () => {
  it("returns the caller's forbidden copy for a 403", () => {
    expect(resolveErrorMessage(new ApiError("Forbidden", 403), copy)).toBe(copy.forbidden);
  });

  it("returns the shared unauthorized copy for a 401", () => {
    expect(resolveErrorMessage(new ApiError("Unauthorized", 401), copy)).toBe(copy.unauthorized);
  });

  it("returns the backend's own message for a validation-like status", () => {
    expect(resolveErrorMessage(new ApiError("Name is required", 400), copy)).toBe("Name is required");
  });

  it("never returns the raw backend message for a 500 — returns the caller's generic copy instead", () => {
    const message = resolveErrorMessage(new ApiError("TypeError: x is not a function", 500), copy);
    expect(message).toBe(copy.generic);
    expect(message).not.toContain("TypeError");
  });

  it("returns the shared network copy for a non-ApiError failure", () => {
    expect(resolveErrorMessage(new TypeError("Failed to fetch"), copy)).toBe(copy.network);
  });
});
