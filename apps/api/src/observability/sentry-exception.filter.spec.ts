import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArgumentsHost, ConflictException, HttpException, NotFoundException } from "@nestjs/common";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

// Imported after the mock so the mocked module is what the filter sees.
import * as Sentry from "@sentry/node";
import { SentryExceptionFilter } from "./sentry-exception.filter";

function buildApplicationRefMock() {
  return {
    isHeadersSent: vi.fn().mockReturnValue(false),
    reply: vi.fn(),
    end: vi.fn(),
  };
}

function buildHost(): ArgumentsHost {
  return {
    getArgByIndex: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;
}

describe("SentryExceptionFilter", () => {
  let applicationRef: ReturnType<typeof buildApplicationRefMock>;
  let filter: SentryExceptionFilter;

  beforeEach(() => {
    vi.clearAllMocks();
    applicationRef = buildApplicationRefMock();
    filter = new SentryExceptionFilter(applicationRef as never);
  });

  it("reports a non-HttpException (an unhandled bug) to Sentry", () => {
    const error = new Error("something exploded");

    filter.catch(error, buildHost());

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("reports a 500-and-above HttpException to Sentry", () => {
    const exception = new HttpException("upstream failure", 502);

    filter.catch(exception, buildHost());

    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });

  it("does NOT report a caller-facing 404 to Sentry", () => {
    const exception = new NotFoundException("Ticket not found");

    filter.catch(exception, buildHost());

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does NOT report a caller-facing 409 to Sentry", () => {
    const exception = new ConflictException("Duplicate name");

    filter.catch(exception, buildHost());

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("still delegates to the default NestJS response handling either way", () => {
    filter.catch(new NotFoundException("Ticket not found"), buildHost());

    expect(applicationRef.reply).toHaveBeenCalledOnce();
    const [, body, status] = applicationRef.reply.mock.calls[0] as [unknown, unknown, number];
    expect(status).toBe(404);
    expect(body).toMatchObject({ statusCode: 404 });
  });

  it("delegates a genuinely unhandled exception as a 500 (NestJS's own default behavior, unchanged)", () => {
    filter.catch(new Error("boom"), buildHost());

    expect(applicationRef.reply).toHaveBeenCalledOnce();
    const [, body, status] = applicationRef.reply.mock.calls[0] as [unknown, unknown, number];
    expect(status).toBe(500);
    expect(body).toMatchObject({ statusCode: 500 });
  });
});
