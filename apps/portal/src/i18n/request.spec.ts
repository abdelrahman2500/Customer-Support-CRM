import { describe, expect, it, vi } from "vitest";
import getRequestConfig from "./request";
import enMessages from "../../messages/en.json";
import arMessages from "../../messages/ar.json";

/** RM-12 — Locale-Routing Test Coverage. Mirrors `apps/web`'s own
 * identical test, including its `next-intl/server` mock — see that
 * file's own doc comment for why the mock exists (a confirmed-identity
 * stand-in for the `react-server` build's `getRequestConfig`, needed
 * because Vitest's jsdom environment resolves the `react-client` build
 * instead, whose own version throws unconditionally). */
vi.mock("next-intl/server", () => ({
  getRequestConfig: (createRequestConfig: unknown) => createRequestConfig,
}));

describe("request config", () => {
  it("resolves the English locale and its own message file for an en request", async () => {
    const config = await getRequestConfig({ requestLocale: Promise.resolve("en") });

    expect(config.locale).toBe("en");
    expect(config.messages).toEqual(enMessages);
  });

  it("resolves the Arabic locale and its own message file for an ar request", async () => {
    const config = await getRequestConfig({ requestLocale: Promise.resolve("ar") });

    expect(config.locale).toBe("ar");
    expect(config.messages).toEqual(arMessages);
  });

  it("falls back to the default locale (English) for an unsupported requested locale", async () => {
    const config = await getRequestConfig({ requestLocale: Promise.resolve("fr") });

    expect(config.locale).toBe("en");
    expect(config.messages).toEqual(enMessages);
  });

  it("falls back to the default locale when no locale segment matched at all", async () => {
    const config = await getRequestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config.locale).toBe("en");
    expect(config.messages).toEqual(enMessages);
  });
});
