import { describe, expect, it } from "vitest";
import { WebhookVerifierRegistry } from "./webhook-verifier";
import type { WebhookVerifier } from "./webhook-verifier";

describe("WebhookVerifierRegistry", () => {
  it("resolves undefined for any providerKey when constructed with no verifiers (the shipped default)", () => {
    const registry = new WebhookVerifierRegistry();

    expect(registry.resolve("stripe")).toBeUndefined();
  });

  it("resolves a verifier registered under its own providerKey", () => {
    const verifier: WebhookVerifier = { verify: () => ({ verified: true }) };
    const registry = new WebhookVerifierRegistry([["test-provider", verifier]]);

    expect(registry.resolve("test-provider")).toBe(verifier);
    expect(registry.resolve("some-other-provider")).toBeUndefined();
  });
});
