import { describe, expect, it } from "vitest";
import type { ChannelAdapter } from "./channel-adapter";
import { ChannelAdapterRegistry } from "./channel-adapter-registry";
import { FirstPartyChannelAdapter } from "./first-party-channel-adapter";

function buildFakeEmailAdapter(): ChannelAdapter {
  return { send: async () => ({}), parseInbound: () => null };
}

describe("ChannelAdapterRegistry", () => {
  describe("resolve", () => {
    it("resolves the shared FirstPartyChannelAdapter for LIVE_CHAT, WEB_FORM, and AI_CHAT", () => {
      const firstPartyAdapter = new FirstPartyChannelAdapter();
      const registry = new ChannelAdapterRegistry(firstPartyAdapter);

      expect(registry.resolve("LIVE_CHAT")).toBe(firstPartyAdapter);
      expect(registry.resolve("WEB_FORM")).toBe(firstPartyAdapter);
      expect(registry.resolve("AI_CHAT")).toBe(firstPartyAdapter);
    });

    it("resolves undefined for WHATSAPP and SMS — no adapter registered until a Phase 5 story adds one", () => {
      const registry = new ChannelAdapterRegistry(new FirstPartyChannelAdapter());

      expect(registry.resolve("WHATSAPP")).toBeUndefined();
      expect(registry.resolve("SMS")).toBeUndefined();
    });

    // RM-15 — Email Adapter (Outbound).
    it("resolves undefined for EMAIL when no email adapter was constructed (SMTP not configured)", () => {
      const registry = new ChannelAdapterRegistry(new FirstPartyChannelAdapter(), undefined);

      expect(registry.resolve("EMAIL")).toBeUndefined();
    });

    it("resolves the given adapter for EMAIL when one was constructed (SMTP configured)", () => {
      const emailAdapter = buildFakeEmailAdapter();
      const registry = new ChannelAdapterRegistry(new FirstPartyChannelAdapter(), emailAdapter);

      expect(registry.resolve("EMAIL")).toBe(emailAdapter);
    });
  });
});
