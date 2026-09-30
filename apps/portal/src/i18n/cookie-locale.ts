import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Story 177 — resolves the active locale for a route that renders OUTSIDE the
 * `[locale]` segment, where there is no segment value to read.
 *
 * The root not-found boundary is the only such route. It is reached for every
 * unmatched URL (`/en/nope`, `/ar/nope`), and before this story it rendered
 * hard-coded English/LTR no matter which locale the visitor was browsing.
 *
 * The value comes from `NEXT_LOCALE`, which next-intl's middleware already
 * sets on the very same request — verified cold, with no pre-existing cookie,
 * because the middleware runs before this boundary renders. That is why no new
 * locale-negotiation mechanism is introduced here: the infrastructure exists,
 * it just was not being read. `next-intl@4`'s own `receiveRoutingConfig`
 * defaults `localeCookie` to `{name: "NEXT_LOCALE", sameSite: "lax"}`, and
 * neither app overrides it.
 *
 * `hasLocale` is the same guard `[locale]/layout.tsx` already applies to the
 * segment value, and it is load-bearing rather than decorative: without it a
 * stale or tampered cookie (`NEXT_LOCALE=xx`) would reach
 * `import(\`../../messages/xx.json\`)` and turn a 404 into a 500.
 *
 * Every other case — cookie missing (a path the middleware matcher excludes,
 * e.g. anything containing a dot), empty, or invalid — falls back to
 * `routing.defaultLocale`, which is exactly what every request rendered before
 * this story.
 */
export function resolveCookieLocale(value: string | undefined): string {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
