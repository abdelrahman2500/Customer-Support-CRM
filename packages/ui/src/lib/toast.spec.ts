import { describe, expect, it } from "vitest";
import { toastCardClassName, toastRegionClassName, toastToneClassName } from "./toast";

describe("toast classes (Story 190, RD-1.13)", () => {
  it("keeps the region inside a 320px viewport and a 24rem end column from sm", () => {
    const classes = toastRegionClassName.split(" ");
    expect(classes).toEqual(
      expect.arrayContaining(["fixed", "inset-x-4", "sm:inset-x-auto", "sm:end-4", "sm:w-96"]),
    );
    expect(classes).not.toContain("w-full");
  });

  it("uses the raised surface, surface radius and overlay elevation", () => {
    expect(toastCardClassName.split(" ")).toEqual(
      expect.arrayContaining([
        "rounded-surface",
        "bg-surface-raised",
        "shadow-overlay",
        "pointer-events-auto",
      ]),
    );
  });

  it("maps each tone to its semantic border", () => {
    expect(toastToneClassName).toEqual({
      success: "border-success-border",
      info: "border-info-border",
      warning: "border-warning-border",
      error: "border-danger-border",
    });
  });
});
