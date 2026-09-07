import { describe, expect, it } from "vitest";
import { ChannelAdapterRegistry } from "./channel-adapter-registry";
import { FirstPartyChannelAdapter } from "./first-party-channel-adapter";

describe("ChannelAdapterRegistry", () => {
  describe("resolve", () => {
    it("resolves the shared FirstPartyChannelAdapter for LIVE_CHAT, WEB_FORM, and AI_CHAT", () => {
      const firstPartyAdapter = new FirstPartyChannelAdapter();
      const registry = new ChannelAdapterRegistry(firstPartyAdapter);

      expect(registry.resolve("LIVE_CHAT")).toBe(firstPartyAdapter);
      expect(registry.resolve("WEB_FORM")).toBe(firstPartyAdapter);
      expect(registry.resolve("AI_CHAT")).toBe(firstPartyAdapter);
    });

    it("resolves undefined for EMAIL, WHATSAPP, and SMS — no adapter registered until a Phase 5 story adds one", () => {
      const registry = new ChannelAdapterRegistry(new FirstPartyChannelAdapter());

      expect(registry.resolve("EMAIL")).toBeUndefined();
      expect(registry.resolve("WHATSAPP")).toBeUndefined();
      expect(registry.resolve("SMS")).toBeUndefined();
    });
  });
});
