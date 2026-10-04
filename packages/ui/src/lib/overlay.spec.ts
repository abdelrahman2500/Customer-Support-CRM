import { describe, expect, it } from "vitest";
import { overlayClassName, overlayPanelClassName, overlayPanelSizeClassName } from "./overlay";

/**
 * Story 187 (RD-1.10) — the one overlay treatment shared by Dialog,
 * AlertDialog/ConfirmDialog (and, for the scrim, NavigationOverlay).
 */
describe("overlayClassName (the scrim)", () => {
  it("uses the overlay token at 50% and fades in and out", () => {
    expect(overlayClassName).toContain("bg-overlay/50");
    expect(overlayClassName).toContain("data-[state=open]:animate-fade-in");
    expect(overlayClassName).toContain("data-[state=closed]:animate-fade-out");
  });
});

describe("overlayPanelClassName (the centred panel)", () => {
  const tokens = overlayPanelClassName.split(" ");

  it("is the raised overlay surface", () => {
    for (const token of ["bg-surface-raised", "rounded-surface", "shadow-overlay", "border-rule"]) {
      expect(tokens).toContain(token);
    }
  });

  it("is bounded to the viewport and scrolls internally", () => {
    expect(tokens).toContain("max-h-[calc(100dvh-2rem)]");
    expect(tokens).toContain("overflow-y-auto");
  });

  it("keeps the 320px gutter and the RTL centring correction", () => {
    expect(tokens).toContain("w-[calc(100%-2rem)]");
    expect(tokens).toContain("-translate-x-1/2");
    expect(tokens).toContain("rtl:translate-x-1/2");
  });

  it("keeps block layout so existing dialog content lays out as before", () => {
    expect(tokens).not.toContain("flex");
    expect(tokens).not.toContain("flex-col");
  });

  it("scales from its inline-start corner so the centre stays fixed while zooming", () => {
    expect(tokens).toContain("origin-top-left");
    expect(tokens).toContain("rtl:origin-top-right");
  });

  it("opens and closes with the zoom motion", () => {
    expect(tokens).toContain("data-[state=open]:animate-zoom-in");
    expect(tokens).toContain("data-[state=closed]:animate-zoom-out");
  });
});

describe("overlayPanelSizeClassName", () => {
  it("maps four sizes to four distinct widths, with md as today's width", () => {
    expect(overlayPanelSizeClassName).toEqual({
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
      xl: "max-w-2xl",
    });
    expect(new Set(Object.values(overlayPanelSizeClassName)).size).toBe(4);
  });
});
