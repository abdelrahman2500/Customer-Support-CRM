import { describe, expect, it } from "vitest";
import { routing } from "./routing";

/** RM-12 — Locale-Routing Test Coverage. `routing` is the one source both
 * `middleware.ts` (locale-prefix redirects, including an unsupported-locale
 * fallback — next-intl's own middleware, exercised through this config
 * rather than reimplemented/re-tested here) and `request.ts` (see
 * `request.spec.ts`) build on, so this is the config's own direct
 * assertion: exactly the two locales `docs/architecture/10-i18n-and-rtl.md`
 * requires, defaulting to English. */
describe("routing", () => {
  it("supports exactly English and Arabic", () => {
    expect(routing.locales).toEqual(["en", "ar"]);
  });

  it("defaults to English", () => {
    expect(routing.defaultLocale).toBe("en");
  });
});
