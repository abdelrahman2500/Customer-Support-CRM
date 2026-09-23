/**
 * Story 168 regression guard — the portal twin of
 * `apps/web/src/test/login-messages.spec.ts`.
 *
 * Same reasoning, one difference: the language-switcher keys live under
 * `home` here, not `workspace`, because that is where Story 119 put them for
 * this app. The Login screen reuses them rather than adding a pre-auth
 * duplicate.
 */
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

const CATALOGS = { en, ar } as const;

describe("login messages (portal)", () => {
  for (const [locale, messages] of Object.entries(CATALOGS)) {
    describe(locale, () => {
      const nonEmpty = (value: unknown) => {
        expect(value).toBeTypeOf("string");
        expect((value as string).trim()).not.toBe("");
      };

      it("has every auth key the screen renders", () => {
        nonEmpty(messages.auth.title);
        nonEmpty(messages.auth.email);
        nonEmpty(messages.auth.password);
        nonEmpty(messages.auth.signIn);
        nonEmpty(messages.auth.signingIn);
        nonEmpty(messages.auth.loginFailed);
      });

      it("has the product name used as the screen's identity", () => {
        nonEmpty(messages.common.appName);
      });

      it("has the session-expired copy", () => {
        nonEmpty(messages.common.errors.unauthorized);
      });

      it("has the language-switcher keys the pre-auth switcher reuses", () => {
        nonEmpty(messages.home.languageSwitcher.label);
        nonEmpty(messages.home.languageSwitcher.options.en);
        nonEmpty(messages.home.languageSwitcher.options.ar);
      });

      /** Story 175 — the split composition's product messaging. A key missing
       * from one catalogue would render its raw path on the product's front
       * door, which no render test in this repo would catch. */
      it("has every marketing key the brand panel renders", () => {
        nonEmpty(messages.auth.marketing.headline);
        nonEmpty(messages.auth.marketing.subheadline);
        for (const key of ["tickets", "knowledge", "notifications"] as const) {
          nonEmpty(messages.auth.marketing.features[key].title);
          nonEmpty(messages.auth.marketing.features[key].description);
        }
      });

      it("distinguishes the idle and pending submit labels", () => {
        expect(messages.auth.signIn).not.toBe(messages.auth.signingIn);
      });
    });
  }

  it("translates the product name, rather than leaving the English one in place", () => {
    expect(en.common.appName).not.toBe(ar.common.appName);
  });

  /** Catches an untranslated copy-paste of the marketing block. */
  it("translates the marketing headline and subheadline", () => {
    expect(en.auth.marketing.headline).not.toBe(ar.auth.marketing.headline);
    expect(en.auth.marketing.subheadline).not.toBe(ar.auth.marketing.subheadline);
  });
});
