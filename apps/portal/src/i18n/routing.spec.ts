import { describe, expect, it } from "vitest";
import { routing } from "./routing";

/** RM-12 — Locale-Routing Test Coverage. Mirrors `apps/web`'s own
 * identical test; see that file's own doc comment. */
describe("routing", () => {
  it("supports exactly English and Arabic", () => {
    expect(routing.locales).toEqual(["en", "ar"]);
  });

  it("defaults to English", () => {
    expect(routing.defaultLocale).toBe("en");
  });
});
