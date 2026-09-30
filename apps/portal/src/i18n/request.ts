import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Story 177 — `locale` is now read alongside `requestLocale`, and preferred
 * over it. next-intl supplies it whenever a caller passes one explicitly, e.g.
 * `getTranslations({locale})`.
 *
 * That is how the root not-found boundary sources its copy. It renders OUTSIDE
 * the `[locale]` segment, so `requestLocale` is `undefined` there — next-intl's
 * own `GetRequestConfigParams` documents exactly this case — and without this
 * line the config would silently fall back to `defaultLocale` and serve English
 * on `/ar/nope` while looking entirely correct.
 *
 * Additive by construction: no existing caller passes an explicit locale, so
 * `explicitLocale` is `undefined` for every route that already worked and the
 * `requestLocale` path is unchanged for them.
 */
export default getRequestConfig(async ({ locale: explicitLocale, requestLocale }) => {
  const requested = explicitLocale ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
