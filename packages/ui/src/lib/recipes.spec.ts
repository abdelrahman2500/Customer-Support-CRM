import { describe, expect, it } from "vitest";
import { recipes } from "./recipes";
import * as ui from "../index";

/** Story 210 (PR-1.1) — the surface recipes and the four-level elevation rule. */
describe("surface recipes", () => {
  it("keeps resting surfaces flat: borders, never shadows", () => {
    for (const name of ["card", "column", "inner", "chrome"] as const) {
      expect(recipes[name], name).not.toMatch(/(^|\s)shadow-/);
    }
  });

  it("reserves the raised level for the hover of liftable surfaces only", () => {
    expect(recipes.liftable).toContain("hover:shadow-raised");
    expect(recipes.liftable).not.toMatch(/(^|\s)shadow-raised/);
  });

  it("floats overlays on the raised surface at the overlay level", () => {
    expect(recipes.floating).toContain("shadow-overlay");
    expect(recipes.floating).toContain("bg-surface-raised");
  });

  it("scopes the focus ring on the ink chrome", () => {
    expect(recipes.chrome).toContain("on-chrome");
    expect(recipes.chrome).toContain("bg-chrome");
  });

  it("uses token utilities only", () => {
    for (const value of Object.values(recipes)) {
      expect(value).not.toMatch(/\b(slate|gray|zinc|indigo|white|black)-|#[0-9a-f]{3,6}/i);
    }
  });

  it("is exported from the package barrel", () => {
    expect(ui.recipes).toBe(recipes);
  });
});
