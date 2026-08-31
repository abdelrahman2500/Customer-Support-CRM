import { describe, expect, it } from "vitest";
import { NullAiProvider } from "./null-ai-provider";

describe("NullAiProvider", () => {
  const provider = new NullAiProvider();
  const DISABLED = {
    outcome: "DISABLED",
    text: null,
    model: "disabled",
    inputTokens: null,
    outputTokens: null,
    errorMessage: null,
  };

  it("summarize returns a DISABLED result", async () => {
    await expect(provider.summarize({ subject: "s", body: "b" })).resolves.toEqual(DISABLED);
  });

  it("suggestReply returns a DISABLED result", async () => {
    await expect(provider.suggestReply({ subject: "s", body: "b" })).resolves.toEqual(DISABLED);
  });

  it("categorize returns a DISABLED result", async () => {
    await expect(provider.categorize({ subject: "s", body: "b" })).resolves.toEqual(DISABLED);
  });

  it("chat returns a DISABLED result", async () => {
    await expect(provider.chat({ sessionId: "s", message: "m" })).resolves.toEqual(DISABLED);
  });
});
