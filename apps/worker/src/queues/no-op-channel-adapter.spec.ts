import { describe, expect, it } from "vitest";
import { sendViaNoOpAdapter } from "./no-op-channel-adapter";

describe("sendViaNoOpAdapter", () => {
  it("always resolves with a fake externalMessageId, never touching the network", async () => {
    const result = await sendViaNoOpAdapter({ channelMessageId: "message-1", body: "Hello" });

    expect(result.externalMessageId).toMatch(/^noop-/);
  });

  it("generates a distinct externalMessageId per call", async () => {
    const first = await sendViaNoOpAdapter({ channelMessageId: "message-1", body: "Hello" });
    const second = await sendViaNoOpAdapter({ channelMessageId: "message-2", body: "Hello again" });

    expect(first.externalMessageId).not.toBe(second.externalMessageId);
  });
});
