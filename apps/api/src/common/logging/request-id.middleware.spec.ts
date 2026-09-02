import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { CorrelationIdStore } from "./correlation-id.store";
import { RequestIdMiddleware } from "./request-id.middleware";

function buildRequest(headers: Record<string, string | string[] | undefined> = {}): Request {
  return { headers } as unknown as Request;
}

function buildResponse(): Response & { setHeader: ReturnType<typeof vi.fn> } {
  return { setHeader: vi.fn() } as unknown as Response & { setHeader: ReturnType<typeof vi.fn> };
}

describe("RequestIdMiddleware", () => {
  it("generates a fresh id when no x-request-id header is present", () => {
    const middleware = new RequestIdMiddleware();
    const req = buildRequest();
    const res = buildResponse();
    let seenInsideNext: string | undefined;

    middleware.use(req, res, () => {
      seenInsideNext = CorrelationIdStore.get();
    });

    expect(seenInsideNext).toBeTypeOf("string");
    expect(seenInsideNext).toHaveLength(36); // UUID
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", seenInsideNext);
  });

  it("honors a caller-supplied x-request-id header instead of generating one", () => {
    const middleware = new RequestIdMiddleware();
    const req = buildRequest({ "x-request-id": "caller-supplied-id" });
    const res = buildResponse();
    let seenInsideNext: string | undefined;

    middleware.use(req, res, () => {
      seenInsideNext = CorrelationIdStore.get();
    });

    expect(seenInsideNext).toBe("caller-supplied-id");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "caller-supplied-id");
  });

  it("generates a fresh id when the header is present but empty", () => {
    const middleware = new RequestIdMiddleware();
    const req = buildRequest({ "x-request-id": "" });
    const res = buildResponse();
    let seenInsideNext: string | undefined;

    middleware.use(req, res, () => {
      seenInsideNext = CorrelationIdStore.get();
    });

    expect(seenInsideNext).toBeTruthy();
    expect(seenInsideNext).not.toBe("");
  });

  it("uses the first value when x-request-id arrives as an array (duplicate headers)", () => {
    const middleware = new RequestIdMiddleware();
    const req = buildRequest({ "x-request-id": ["first-id", "second-id"] });
    const res = buildResponse();
    let seenInsideNext: string | undefined;

    middleware.use(req, res, () => {
      seenInsideNext = CorrelationIdStore.get();
    });

    expect(seenInsideNext).toBe("first-id");
  });

  it("calls next() exactly once", () => {
    const middleware = new RequestIdMiddleware();
    const req = buildRequest();
    const res = buildResponse();
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("no longer exposes the id once use() has returned", () => {
    const middleware = new RequestIdMiddleware();
    const req = buildRequest();
    const res = buildResponse();

    middleware.use(req, res, () => undefined);

    expect(CorrelationIdStore.get()).toBeUndefined();
  });
});
