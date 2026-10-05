import { describe, expect, it } from "vitest";
import { toneSpine, type SpineTone } from "./status-spine";

describe("toneSpine", () => {
  const tones: SpineTone[] = ["neutral", "info", "progress", "success", "warning", "danger"];

  it("gives every tone a border, a dot and a top edge", () => {
    for (const tone of tones) {
      const spine = toneSpine(tone);
      expect(spine.border).toMatch(/^border-/);
      expect(spine.dot).toMatch(/^bg-/);
      expect(spine.top).toMatch(/^border-t-/);
      expect(spine.start).toMatch(/^border-s-/);
    }
  });

  it("uses a distinct hue per tone", () => {
    expect(new Set(tones.map((tone) => toneSpine(tone).border)).size).toBe(tones.length);
  });
});
