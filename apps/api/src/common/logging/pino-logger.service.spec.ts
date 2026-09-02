import { beforeEach, describe, expect, it, vi } from "vitest";
import { CorrelationIdStore } from "./correlation-id.store";

const pinoInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
};

vi.mock("pino", () => ({
  default: vi.fn(() => pinoInstance),
}));

// Imported after the mock so the mocked factory is what the service sees.
import { PinoLoggerService } from "./pino-logger.service";

describe("PinoLoggerService", () => {
  let service: PinoLoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PinoLoggerService();
  });

  it("logs a plain string message with no bindings when there is no active context/correlation id", () => {
    service.log("hello");

    expect(pinoInstance.info).toHaveBeenCalledWith({}, "hello");
  });

  it("includes the Nest context as a bound field", () => {
    service.log("hello", "MyService");

    expect(pinoInstance.info).toHaveBeenCalledWith({ context: "MyService" }, "hello");
  });

  it("merges the active correlation id into the bindings", () => {
    CorrelationIdStore.run("request-1", () => service.log("hello", "MyService"));

    expect(pinoInstance.info).toHaveBeenCalledWith(
      { context: "MyService", correlationId: "request-1" },
      "hello",
    );
  });

  it("omits correlationId entirely when none is active", () => {
    service.warn("careful");

    const [bindings] = pinoInstance.warn.mock.calls[0] as [Record<string, unknown>, string];
    expect(bindings).not.toHaveProperty("correlationId");
  });

  it("stringifies a non-string message", () => {
    service.debug({ some: "object" });

    expect(pinoInstance.debug).toHaveBeenCalledWith({}, JSON.stringify({ some: "object" }));
  });

  it("routes error() through pino's error level, including the trace field", () => {
    service.error("boom", "stack trace here", "MyService");

    expect(pinoInstance.error).toHaveBeenCalledWith(
      { context: "MyService", trace: "stack trace here" },
      "boom",
    );
  });

  it("routes verbose() through pino's trace level", () => {
    service.verbose("detail");

    expect(pinoInstance.trace).toHaveBeenCalledWith({}, "detail");
  });

  it("routes fatal() through pino's fatal level", () => {
    service.fatal("critical");

    expect(pinoInstance.fatal).toHaveBeenCalledWith({}, "critical");
  });
});
