import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnthropicAiProvider } from "./anthropic-ai-provider";

const createMock = vi.fn();

// A real `function` declaration, not an arrow function — `new Anthropic(...)`
// requires a constructor, and `vi.fn().mockImplementation(() => ({...}))`
// throws "is not a constructor".
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function AnthropicMock(this: Record<string, unknown>) {
    this.messages = { create: createMock };
  }),
}));

function createProvider(config = { apiKey: "test-key", model: "claude-test-model" }): AnthropicAiProvider {
  return new AnthropicAiProvider(config);
}

describe("AnthropicAiProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("summarize", () => {
    it("returns a SUCCESS result with the real token/latency figures from a successful call", async () => {
      createMock.mockResolvedValue({
        content: [{ type: "text", text: "A short summary." }],
        model: "claude-test-model",
        usage: { input_tokens: 42, output_tokens: 7 },
      });
      const provider = createProvider();

      const result = await provider.summarize({ subject: "Login issue", body: "I can't log in." });

      expect(result).toEqual({
        outcome: "SUCCESS",
        text: "A short summary.",
        model: "claude-test-model",
        inputTokens: 42,
        outputTokens: 7,
        errorMessage: null,
      });
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-test-model",
          messages: [
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining("Login issue"),
            }),
          ],
        }),
      );
    });

    it("joins multiple text content blocks and ignores non-text blocks", async () => {
      createMock.mockResolvedValue({
        content: [
          { type: "text", text: "First." },
          { type: "tool_use", id: "x", name: "n", input: {} },
          { type: "text", text: "Second." },
        ],
        model: "claude-test-model",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      const provider = createProvider();

      const result = await provider.summarize({ subject: "s", body: "b" });

      expect(result.text).toBe("First.\nSecond.");
    });

    it("returns an ERROR result (never throws) when the SDK call rejects", async () => {
      createMock.mockRejectedValue(new Error("rate limited"));
      const provider = createProvider();

      const result = await provider.summarize({ subject: "s", body: "b" });

      expect(result).toEqual({
        outcome: "ERROR",
        text: null,
        model: "claude-test-model",
        inputTokens: null,
        outputTokens: null,
        errorMessage: "rate limited",
      });
    });
  });

  describe("suggestReply / categorize / chat", () => {
    beforeEach(() => {
      createMock.mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
        model: "claude-test-model",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    });

    it("suggestReply calls the SDK and returns SUCCESS", async () => {
      const provider = createProvider();
      const result = await provider.suggestReply({ subject: "s", body: "b" });
      expect(result.outcome).toBe("SUCCESS");
      expect(createMock).toHaveBeenCalledOnce();
    });

    it("categorize calls the SDK and returns SUCCESS", async () => {
      const provider = createProvider();
      const result = await provider.categorize({ subject: "s", body: "b" });
      expect(result.outcome).toBe("SUCCESS");
      expect(createMock).toHaveBeenCalledOnce();
    });

    it("chat sends the raw message as the prompt when there is no prior history", async () => {
      const provider = createProvider();
      const result = await provider.chat({ sessionId: "sess-1", message: "hello", history: [] });
      expect(result.outcome).toBe("SUCCESS");
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "hello" }],
        }),
      );
    });

    // Story 116 — conversation memory.
    it("chat includes prior history, oldest-first, before the current message", async () => {
      const provider = createProvider();
      const result = await provider.chat({
        sessionId: "sess-1",
        message: "And then what happened?",
        history: [
          { role: "user", content: "I ordered a widget last week." },
          { role: "assistant", content: "I can help with that. What's the order number?" },
        ],
      });

      expect(result.outcome).toBe("SUCCESS");
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "user", content: "I ordered a widget last week." },
            { role: "assistant", content: "I can help with that. What's the order number?" },
            { role: "user", content: "And then what happened?" },
          ],
        }),
      );
    });
  });

  describe("construction", () => {
    it("constructs the Anthropic client with the plain apiKey passed in — no ConfigService, no env lookup", async () => {
      createProvider({ apiKey: "a-specific-key", model: "a-specific-model" });

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: "a-specific-key" });
    });
  });
});
