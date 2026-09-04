/**
 * Story S-7 regression guard.
 *
 * `QueryStateCard`'s `loadingLabel` and `FetchingIndicator`'s `label` are
 * required props, and `@crm/ui` deliberately owns no copy — so both strings
 * have to come from this app's own catalog. A missing key would not fail the
 * build or the type check; next-intl would render the key path itself, and
 * an Arabic user would see the literal text `common.updating` in a live
 * region. This asserts both keys exist in both locales.
 *
 * Scoped to the two keys this story introduced or started depending on
 * rather than sweeping the whole catalog, which is a separate concern.
 */
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

const CATALOGS = { en, ar } as const;

describe("fetch-state messages", () => {
  for (const [locale, messages] of Object.entries(CATALOGS)) {
    describe(locale, () => {
      it("has common.loading, for the initial-load announcement", () => {
        expect(messages.common.loading).toBeTypeOf("string");
        expect(messages.common.loading.trim()).not.toBe("");
      });

      it("has common.updating, for the background-refetch indicator", () => {
        expect(messages.common.updating).toBeTypeOf("string");
        expect(messages.common.updating.trim()).not.toBe("");
      });
    });
  }

  it("distinguishes loading from updating, in both locales", () => {
    // "nothing on screen yet" and "what is on screen is being replaced" are
    // different states, so they must not collapse to the same words.
    expect(en.common.loading).not.toBe(en.common.updating);
    expect(ar.common.loading).not.toBe(ar.common.updating);
  });

  it("actually translates both strings into Arabic", () => {
    expect(ar.common.loading).not.toBe(en.common.loading);
    expect(ar.common.updating).not.toBe(en.common.updating);
    // Arabic script, not a latin placeholder left behind.
    expect(ar.common.updating).toMatch(/[\u0600-\u06FF]/);
  });
});
