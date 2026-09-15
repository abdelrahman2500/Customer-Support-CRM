import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createTicketAsAdmin, loginAsAdmin } from "./support/api-client";

/**
 * P1-2 Journey 1 — Login -> session expiry -> refresh/recovery.
 *
 * Story 41 built the silent-refresh path (`apiFetch` catches a `401`,
 * calls the de-duplicated `refreshAccessTokenOnce()`, retries the original
 * request) and Story 95 built the give-up path (`emitAuthExpired()` ->
 * `AuthRecoveryListener` -> `/{locale}/login?reason=session-expired`).
 * Both are covered by unit tests at the module level (`lib/api.spec.ts`,
 * `components/providers/auth-recovery-listener.spec.tsx`), but nothing
 * previously exercised them end to end: a real browser holding real
 * cookies, a real `apps/api` issuing the `401`, and a real
 * `POST /auth/refresh` round-trip deciding which of the two outcomes
 * happens.
 *
 * ## Why the cookie is deleted rather than waited out
 *
 * The access token's TTL is 15 minutes (`JWT_ACCESS_TTL`), so waiting for
 * a genuine expiry is not an option for a suite that runs in seconds.
 * Deleting the `crm_access_token` cookie produces the same observable
 * state the client code branches on: `getAccessToken()` returns `null`,
 * `apiFetch` sends no `Authorization` header, and the global `AuthGuard`
 * answers `401` — the exact input the recovery path exists to handle. No
 * production code is stubbed, mocked, or modified to make this happen,
 * and no clock is faked.
 *
 * ## Why the test must NOT navigate after deleting the cookie
 *
 * `(agent)/layout.tsx` has its own server-side guard that reads the same
 * `crm_access_token` cookie and `redirect(`/${locale}/login`)`s — note:
 * with no `?reason=` query at all. A `page.goto()`/reload after deleting
 * the cookie would therefore be answered by *that* guard, and the test
 * would pass while proving nothing about `apiFetch`'s own 401 handling.
 * The journey under test here is strictly the client-side one, so the
 * trigger below is an ordinary in-page interaction that fires a real
 * client-side request without a full page navigation.
 *
 * ## Why the search filter is the trigger
 *
 * `useTicketsQuery(filters)` keys its cache on the whole filter object
 * (`ticketsQueryKey`), so committing a search term the browser has never
 * queried before is a guaranteed cache miss -> a genuine network request,
 * never a cached answer. It is also a real interaction an agent performs
 * constantly (`agent-resolves-ticket.spec.ts` already relies on it to
 * find a freshly-created ticket), and `useUrlFilters` updates its React
 * state synchronously on commit while mirroring it to the URL in a
 * *follow-up* effect — so the query fires before, and independently of,
 * the `router.replace`.
 *
 * Searching for a fixture ticket created through the real API (rather
 * than an arbitrary string) is what makes the recoverable assertion
 * meaningful: the row can only appear if the retried request carried a
 * genuinely new, valid access token.
 */
test.use({ baseURL: "http://localhost:3000" });

const ACCESS_TOKEN_COOKIE = "crm_access_token";
const REFRESH_TOKEN_COOKIE = "refreshToken";

/** Signs in through the real login form — deliberately not `storageState`.
 * The act of authenticating is part of this journey, and the cookies the
 * rest of the test manipulates have to be the ones the app itself issued
 * (the non-httpOnly access cookie written by the login page, and the
 * httpOnly refresh cookie set by `apps/api`), not ones replayed from a
 * serialized fixture. */
async function signIn(page: Page): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL as string;
  const password = process.env.SEED_ADMIN_PASSWORD as string;

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/tickets$/);
}

/**
 * Commits a search term on the tickets list — the in-page interaction
 * that fires `useTicketsQuery`'s real client-side request. The filter
 * commits on blur, exactly as a user tabbing out of the field would.
 *
 * The blur is a keyboard `Tab` rather than `search.blur()` on purpose. In
 * the unrecoverable test, clearing both cookies arms every other live
 * client-side consumer on this page (the shared socket's `onReconnect`
 * invalidation, `BranchNotifications`' preferences/templates queries) to
 * 401 -> fail refresh -> redirect to login. Whichever request gets there
 * first wins, so the page can navigate away between the two lines below —
 * and a locator-based `blur()` would then block for the full test timeout
 * waiting for a search box that no longer exists (observed: ~17% of runs
 * timing out at 30s, with the redirect under test having already
 * succeeded). `page.keyboard.press` acts on whatever is focused without
 * re-resolving a locator, so it simply does nothing in that case and the
 * assertions that follow still judge the outcome. Nothing is retried,
 * slowed, or softened: the redirect remains the only thing asserted.
 */
async function searchTickets(page: Page, term: string): Promise<void> {
  const search = page.getByPlaceholder("Search by subject or category...");
  await search.fill(term);
  await page.keyboard.press("Tab");
}

async function cookieNames(context: BrowserContext): Promise<string[]> {
  return (await context.cookies()).map((cookie) => cookie.name);
}

test("an expired access token is silently refreshed and the request retried", async ({
  page,
  context,
}) => {
  const subject = `Playwright — session refresh ${randomUUID()}`;
  const adminToken = await loginAsAdmin();
  await createTicketAsAdmin(adminToken, subject);

  await signIn(page);
  expect(await cookieNames(context)).toContain(ACCESS_TOKEN_COOKIE);

  // Expire the session the way the browser eventually would, leaving the
  // httpOnly refresh cookie (7-day TTL) intact — this is the recoverable
  // shape: the access token is gone, the session behind it is not.
  await context.clearCookies({ name: ACCESS_TOKEN_COOKIE });
  expect(await cookieNames(context)).not.toContain(ACCESS_TOKEN_COOKIE);
  expect(await cookieNames(context)).toContain(REFRESH_TOKEN_COOKIE);

  await searchTickets(page, subject);

  // The fixture row can only render if the whole chain completed: the
  // request 401'd, `POST /auth/refresh` succeeded off the refresh cookie,
  // and the original `GET /tickets` was retried with the new token and
  // returned real, branch-scoped data.
  await expect(page.getByText(subject)).toBeVisible();

  // Still authenticated, still on the same page — no redirect, no
  // server-guard bounce, no sign-out.
  await expect(page).toHaveURL(/\/en\/tickets(\?|$)/);
  await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();

  // `setAccessToken` writes the refreshed cookie from the browser, so it
  // lands in the context a moment after the retried request resolves.
  await expect
    .poll(async () => await cookieNames(context))
    .toContain(ACCESS_TOKEN_COOKIE);
});

test("an unrecoverable session redirects to login with the expired notice", async ({
  page,
  context,
}) => {
  const subject = `Playwright — session expiry ${randomUUID()}`;
  const adminToken = await loginAsAdmin();
  await createTicketAsAdmin(adminToken, subject);

  await signIn(page);

  // Record every navigation from here on, so "no auth loop" can be
  // asserted on evidence rather than on a sleep: a loop would bounce
  // back into the protected area and out again.
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      navigations.push(frame.url());
    }
  });

  // Both cookies gone: the access token cannot authenticate the request,
  // and there is no refresh token left to rescue it.
  await context.clearCookies({ name: ACCESS_TOKEN_COOKIE });
  await context.clearCookies({ name: REFRESH_TOKEN_COOKIE });
  const remaining = await cookieNames(context);
  expect(remaining).not.toContain(ACCESS_TOKEN_COOKIE);
  expect(remaining).not.toContain(REFRESH_TOKEN_COOKIE);

  await searchTickets(page, subject);

  // `apiFetch` 401s, `refreshAccessTokenOnce()` also 401s, so it clears
  // the access token and emits the auth-expired event; `AuthRecoveryListener`
  // replaces the history entry with the reason-carrying login URL. The
  // `?reason=session-expired` query is the part that proves this came from
  // the client-side recovery path — `(agent)/layout.tsx`'s server guard
  // redirects to a bare `/en/login` with no query.
  await expect(page).toHaveURL(/\/en\/login\?reason=session-expired$/);
  await expect(page.getByText("Your session has expired. Please sign in again.")).toBeVisible();

  // The login form is usable, not stuck mid-redirect.
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

  // No auth loop: nothing navigated back into the protected workspace
  // after the recovery redirect.
  //
  // Only navigations *after* the first recovery redirect count. Two
  // earlier entries are expected and benign, and asserting on the raw
  // list would be flaky rather than meaningful:
  //  - `useUrlFilters` mirrors the committed search term into the URL in
  //    a follow-up effect (`/en/tickets?search=...`), which may or may
  //    not land before the redirect — a genuine race, observed both ways
  //    while authoring this test.
  //  - the login URL itself is replaced twice, because `QueryProvider`
  //    sets `retry: 1`, so the failing query calls `apiFetch` twice and
  //    each unrecoverable attempt emits its own auth-expired event. Both
  //    `router.replace` calls target the identical URL, so this is
  //    idempotent, not a loop.
  const recoveryIndex = navigations.findIndex((url) =>
    url.includes("/en/login?reason=session-expired"),
  );
  expect(recoveryIndex).toBeGreaterThanOrEqual(0);
  expect(navigations.slice(recoveryIndex + 1).filter((url) => url.includes("/en/tickets"))).toEqual(
    [],
  );
  await expect(page).toHaveURL(/\/en\/login\?reason=session-expired$/);
});
