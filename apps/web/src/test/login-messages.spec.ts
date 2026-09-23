/**
 * Story 168 regression guard.
 *
 * The redesigned Login screen reads from three namespaces — `auth`, `common`
 * (product identity and the session-expired copy) and `workspace` (Story
 * 119's language-switcher keys, reused rather than duplicated). The page's
 * own spec mocks `useTranslations` down to a key echo, so a key missing from
 * a catalogue would not fail there: next-intl would simply render the key
 * path, and an Arabic visitor would see the literal text
 * `workspace.languageSwitcher.label` on the product's front door.
 *
 * Modelled on `fetch-state-messages.spec.ts` — scoped to the keys this one
 * screen depends on rather than sweeping the whole catalogue, which is a
 * separate concern.
 */
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

const CATALOGS = { en, ar } as const;

describe("login messages", () => {
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
        nonEmpty(messages.workspace.languageSwitcher.label);
        nonEmpty(messages.workspace.languageSwitcher.options.en);
        nonEmpty(messages.workspace.languageSwitcher.options.ar);
      });

      it("distinguishes the idle and pending submit labels", () => {
        expect(messages.auth.signIn).not.toBe(messages.auth.signingIn);
      });
    });
  }

  it("translates the product name, rather than leaving the English one in place", () => {
    expect(en.common.appName).not.toBe(ar.common.appName);
  });
});
