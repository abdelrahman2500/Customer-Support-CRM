/**
 * Story 23 — parses the `CORS_ORIGINS` environment variable into the origin
 * list both `main.ts` (REST) and `RedisIoAdapter` (Socket.IO) pass to their
 * respective `cors` options. A small, pure, independently-unit-testable
 * helper — the same "extract the pure piece" convention this codebase
 * already uses (e.g. `apps/worker/src/queues/sla-transition-evaluator.ts`).
 *
 * Fails closed: an unset/empty value parses to `[]`, which rejects every
 * cross-origin request — identical to this API's actual behavior before
 * this story. Nothing is allowed unless a deployment explicitly opts in.
 *
 * Deployment-configuration hardening — a browser's `Origin` request header
 * is *always* exactly `scheme://host[:port]`: no trailing slash, no path, no
 * query, no fragment. `cors` compares the configured strings against that
 * header with `===`, so `https://app.example.com/` (one trailing slash) or
 * `https://app.example.com/login` never matches anything a browser sends and
 * silently rejects every request from an origin the operator believes they
 * just allowed. Because CORS failures surface in the browser as an opaque
 * network error — and, for a login form, as "cannot reach the API" — that
 * mistake is disproportionately expensive to diagnose. Each entry is
 * therefore normalized to a bare origin here, and anything that cannot be
 * normalized is reported rather than quietly kept as a value that can never
 * match.
 */

export interface ParsedCorsOrigins {
  /** Normalized, de-duplicated, browser-comparable origins. */
  origins: string[];
  /**
   * Entries that are not usable as an `Origin` header value, each paired
   * with why. `env.validation.ts` turns each one into a startup failure,
   * rather than letting the app boot with an allow-list the operator will
   * believe is in effect.
   */
  invalid: { value: string; reason: string }[];
}

/**
 * Normalizes one configured entry to the exact string a browser sends in its
 * `Origin` header, or returns why it cannot be. Accepts a bare origin with
 * or without a trailing slash (the single most common way to write one by
 * hand, and harmless once normalized); rejects anything carrying a path,
 * query or fragment, since that indicates the operator pasted a page URL
 * rather than an origin and the intent is genuinely ambiguous.
 */
function normalizeOrigin(value: string): { origin: string } | { reason: string } {
  if (value === "*") {
    return {
      reason:
        '"*" cannot be combined with credentialed requests. This API sets ' +
        "`credentials: true` (the browser must send the refresh-token " +
        "cookie), and the CORS spec forbids a wildcard origin on a " +
        "credentialed response. List each real origin explicitly.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      reason:
        "not a valid absolute URL. An origin must include the scheme, e.g. " +
        '"https://app.example.com" rather than "app.example.com".',
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { reason: `unsupported scheme "${parsed.protocol}" — use http: or https:.` };
  }
  if (parsed.username || parsed.password) {
    return { reason: "must not contain credentials." };
  }
  if (parsed.search || parsed.hash) {
    return { reason: "must not contain a query string or fragment." };
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    return {
      reason:
        `must not contain a path ("${parsed.pathname}"). A browser's Origin ` +
        "header is only ever scheme://host[:port].",
    };
  }

  // `URL.origin` is exactly the browser's own Origin-header serialization:
  // lowercased scheme/host, default ports (80/443) omitted, no trailing
  // slash. That is precisely what `cors` needs to `===` against.
  return { origin: parsed.origin };
}

/**
 * Full parse result — normalized origins plus any entries that could never
 * match a real `Origin` header. Preferred over `parseCorsOrigins` at
 * startup (`env.validation.ts`), where a misconfigured entry should be
 * surfaced loudly.
 */
export function parseCorsOriginsDetailed(raw: string | undefined): ParsedCorsOrigins {
  const origins: string[] = [];
  const invalid: { value: string; reason: string }[] = [];

  if (!raw) {
    return { origins, invalid };
  }

  for (const entry of raw.split(",").map((value) => value.trim())) {
    if (entry.length === 0) {
      continue;
    }
    const result = normalizeOrigin(entry);
    if ("reason" in result) {
      invalid.push({ value: entry, reason: result.reason });
      continue;
    }
    if (!origins.includes(result.origin)) {
      origins.push(result.origin);
    }
  }

  return { origins, invalid };
}

/**
 * The origin list itself — unchanged signature and unchanged fail-closed
 * behavior from Story 23, so `RedisIoAdapter` and every existing caller are
 * untouched. Entries that cannot be normalized are dropped here (they could
 * never have matched anyway); `env.validation.ts` uses
 * `parseCorsOriginsDetailed` above so startup fails instead of silently
 * dropping them.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  return parseCorsOriginsDetailed(raw).origins;
}
