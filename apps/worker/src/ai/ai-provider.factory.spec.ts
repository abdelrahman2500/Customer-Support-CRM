import { describe, expect, it } from "vitest";
import { AnthropicAiProvider, NullAiProvider } from "@crm/ai";
import { createAiProvider } from "./ai-provider.factory";

describe("createAiProvider", () => {
  it("returns a NullAiProvider when no apiKey is configured", () => {
    const provider = createAiProvider({ apiKey: undefined, model: "claude-test" });

    expect(provider).toBeInstanceOf(NullAiProvider);
  });

  it("returns an AnthropicAiProvider when an apiKey is configured", () => {
    const provider = createAiProvider({ apiKey: "test-key", model: "claude-test" });

    expect(provider).toBeInstanceOf(AnthropicAiProvider);
  });
});
