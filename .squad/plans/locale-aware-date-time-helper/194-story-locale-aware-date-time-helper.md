# Story 194 — Locale-aware date/time helper

> CRM UI/UX redesign roadmap item **RD-1.17**. Intake: [`../../stories/locale-aware-date-time-helper/locale-aware-date-time-helper/intake.md`](../../stories/locale-aware-date-time-helper/locale-aware-date-time-helper/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §6 "RD-1.17"; recon RTL-02; decision D4; QA-07.

---

## Prerequisites

- **D4 approved** ("keep current behaviour": `Intl` with `ar`). This Story does not choose a numbering system.
- **Story 192** (`bb5e43b`) added two date sites in `tickets/sla-indicator.tsx`. They are in scope.
- `@crm/ui` is transpiled by both apps (`transpilePackages`), so no package build is needed. `@crm/shared` is not touched.

---

## Story Goal

- One date/time formatting helper over `Intl`, with an explicit locale.
- Adopt it at all 29 inline `toLocale*String(` calls (23 web, 6 portal).
- Add a guard spec so inline calls can't return.

Three properties must hold:
- **en output is unchanged.**
- **ar keeps today's `Intl` behaviour** (D4).
- **The four locale-less sites (RTL-02) now follow the UI locale** instead of the browser's.

**Non-goals:**
- a timezone model (no `timeZone` is passed anywhere, before or after)
- choosing a numbering system (D4)
- adopting relative time at existing sites (there are none today)
- date pickers
- any backend, API, database, auth or routing change

---

## Design decisions

1. **One implementation, in `@crm/ui`, not one per app.**

   The roadmap's component table says "one helper per app … (strings and locale are app concerns)". The helper needs no strings: `Intl` produces every word. The locale is a parameter, which keeps the app concern in the app. Two copies would be duplicated formatting logic, so it lives once in `packages/ui/src/lib/format-date.ts`. That keeps `@crm/ui` translation-free and router-free, as before. This deviation is recorded here and in `progress.md`.
2. **Exact equivalence with what it replaces.** Each function builds an `Intl.DateTimeFormat` with the options `toLocale*String` uses by default (ECMA-402 `ToDateTimeOptions`):

   | Function | Replaces | Options |
   |---|---|---|
   | `formatDateTime(value, locale)` | `toLocaleString(locale)` | year, month, day, hour, minute and second, all `"numeric"` |
   | `formatDate(value, locale)` | `toLocaleDateString(locale)` | year, month, day `"numeric"` |
   | `formatTime(value, locale)` | `toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })` | the chat cards' short time |

   - Formatters are cached by locale and options. `locale` may be `undefined`, which means the runtime default, exactly as today.
   - `value` accepts `string | number | Date`.
   - An invalid date returns `"Invalid Date"`, the same string `toLocaleString` returns, instead of `Intl`'s `RangeError`.
3. **`formatRelative(value, locale, now = new Date())`.** It uses `Intl.RelativeTimeFormat(locale, { numeric: "auto" })` and picks the largest unit that fits (second → minute → hour → day → week → month → year). The roadmap lists it in scope ("absolute, short, time, relative"), so it is specced now for RD-3.x. No existing site uses it, so no rendering changes.
4. **The locale at the four RTL-02 sites.** Each component reads `useParams<{ locale?: string }>()?.locale`, the codebase's existing convention, null-safe because their specs don't mock `next/navigation`. When there is no locale the result is `undefined` and the runtime default applies, which is today's behaviour. Every other site passes its existing `locale`.
5. **The guard.** `apps/web/src/test/inline-date-format.spec.ts` reads every non-spec `.ts`/`.tsx` file under `apps/web/src` and `apps/portal/src` (via `fs`, like `table-mobile-labels.spec.ts`) and fails on `/\.toLocale(?:Date|Time)?String\(/`. It reports `file:line` and points to `formatDateTime`/`formatDate`/`formatTime`.

---

## Context — Read These Files First

1. The 29 call sites (see the intake for the full list). Run `grep -rn "toLocale\(Date\|Time\)\?String(" apps/web/src apps/portal/src`.
2. `packages/ui/src/lib/cn.ts` and `index.ts`, for where the lib exports live.
3. `apps/web/src/test/table-mobile-labels.spec.ts`, the cross-app `fs` scan pattern.
4. The specs of the four RTL-02 components: `api-keys-view.spec.tsx`, `tasks-panel.spec.tsx`, `webhook-subscriptions-view.spec.tsx`. They mock `next-intl` only.

---

## Tasks

1. **Create `packages/ui/src/lib/format-date.ts`** (+ `format-date.spec.ts`), and export the four functions plus the `DateInput` type from `index.ts`.
2. **Web, 23 sites in 14 files.** Replace each call with the matching helper and keep the existing `locale` argument. Add the `@crm/ui` import, as a separate import line where a file has several `@crm/ui` imports.
3. **Web RTL-02 sites:**
   - `ApiKeyRow`, `TaskRow`, `InboundWebhookLog` and `DeliveryAttemptsLog` each add `const locale = useParams<{ locale?: string }>()?.locale;`
   - add the `next/navigation` import where it is missing.
4. **Portal, 6 sites in 6 files.**
5. **Create the guard spec.**

---

## Edge Cases & Failure Modes

- **Invalid or empty date strings.** `"Invalid Date"` is returned, matching today; nothing throws.
- **No locale (specs, or no route context).** `undefined` means the runtime default, the same as today.
- **Formatter cache.** It is keyed by the locale string (or `""` for `undefined`) and the options key. It is small and bounded: two locales by three option sets, plus relative.
- **RTL.** `Intl` output for `ar` includes RLM marks. They are unchanged, since it is the same API with the same options.
- **SSR/hydration.** These are client components. The runtime timezone is used on both server and client exactly as before, so mismatch risk is unchanged.

---

## Test Plan

1. **`format-date.spec.ts`:**
   - for en and ar, across several dates (including midnight and noon), each function equals the `toLocale*String` form it replaces;
   - `undefined` locale equals `toLocaleString()`;
   - an invalid input returns `"Invalid Date"` and doesn't throw;
   - `string`, `number` and `Date` inputs are equivalent;
   - `formatRelative` picks units at the boundaries (59s → seconds, 60s → 1 minute, -1 day → "yesterday" in en via `numeric: "auto"`, months, years).
2. **The guard spec** passes after adoption. Verify it fails when one inline call is reintroduced (a manual check, reverted).
3. **View specs:** all existing web and portal specs pass unchanged, which proves en equivalence at the call sites.

---

## Verification Steps

1. `pnpm --filter @crm/ui test`, `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal test`.
2. Typecheck and lint for ui, web and portal.
3. Web and portal production builds.
4. Harness: pages with dates at 320 and 1280 × en/ar:
   - web: ticket list, ticket detail, customers list, audit log, API keys, webhook subscriptions;
   - portal: home, ticket detail.

   Check that dates render, there is 0 overflow, and the API keys and webhooks pages in ar show Arabic-formatted dates (the RTL-02 fix).
5. Run `git diff --check`, review the complete diff, run prettier only on the changed files, and confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] `formatDateTime`/`formatDate`/`formatTime`/`formatRelative` in `@crm/ui`, with equivalence and edge specs.
- [ ] All 29 sites adopted; the guard spec finds 0 inline calls.
- [ ] The RTL-02 sites follow the UI locale.
- [ ] en output is unchanged; ar keeps today's `Intl` behaviour (D4); no timezone change.
- [ ] Tests, typecheck, lint and builds pass; harness 0 overflow.
- [ ] No backend, API, database, auth or routing change.
