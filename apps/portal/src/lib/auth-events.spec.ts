import { describe, expect, it, vi } from "vitest";
import { emitAuthExpired, onAuthExpired } from "./auth-events";

describe("auth-events (portal)", () => {
  it("notifies a subscribed listener when the event is emitted", () => {
    const listener = vi.fn();
    onAuthExpired(listener);

    emitAuthExpired();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("notifies every subscribed listener, not just the first", () => {
    const first = vi.fn();
    const second = vi.fn();
    onAuthExpired(first);
    onAuthExpired(second);

    emitAuthExpired();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("stops notifying a listener once it unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = onAuthExpired(listener);
    unsubscribe();

    emitAuthExpired();

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not throw when emitted with no subscribers", () => {
    expect(() => emitAuthExpired()).not.toThrow();
  });
});
