import { describe, expect, it } from "vitest";
import { localeDirection } from "./direction";

describe("localeDirection", () => {
  it("resolves rtl for Arabic", () => {
    expect(localeDirection("ar")).toBe("rtl");
  });

  it("resolves ltr for English", () => {
    expect(localeDirection("en")).toBe("ltr");
  });

  it("resolves ltr for any locale outside routing.locales — the safe default", () => {
    expect(localeDirection("fr")).toBe("ltr");
  });
});
