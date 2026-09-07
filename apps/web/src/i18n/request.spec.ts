import { describe, expect, it, vi } from "vitest";
import getRequestConfig from "./request";
import enMessages from "../../messages/en.json";
import arMessages from "../../messages/ar.json";

/**
 * RM-12 — Locale-Routing Test Coverage. `next-intl/server`'s own
 * `react-server` build's `getRequestConfig` is a confirmed identity
 * passthrough (`return createRequestConfig`) — it exists purely for type
 * inference, not runtime behavior. Vitest's jsdom environment resolves
 * `next-intl/server` to its `react-client` build instead (no
 * `react-server` condition set outside a real Next.js RSC build), whose
 * own `getRequestConfig` throws unconditionally ("not supported in Client
 * Components") — so this mocks the import to that same confirmed-identity
 * behavior, letting `request.ts`'s default export be called directly here
 * exactly as Next.js's own next-intl plugin calls it, with a
 * `requestLocale` promise standing in for the `[locale]` segment the real
 * middleware/route match would otherwise supply.
 */
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
