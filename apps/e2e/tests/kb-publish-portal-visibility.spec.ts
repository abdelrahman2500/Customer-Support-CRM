import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";
import { createPortalContactAsAdmin, loginAsAdmin } from "./support/api-client";

/**
 * P1-2 Journey 3 — Knowledge Base publish -> Portal visibility.
 *
 * The one KB behavior that cannot be proved inside a single app: an
 * article authored in the Agent Workspace (`apps/web`) is invisible to a
 * signed-in portal reader (`apps/portal`) until an agent publishes it,
 * and visible immediately afterwards. The DRAFT/PUBLISHED split is
 * enforced on the backend — `PortalKnowledgeBaseController` calls
 * `listPublishedArticlesForBranch`/`getPublishedArticleForBranch`, never
 * the agent-facing list — so the guarantee only holds if the real API,
 * the real portal-audience token, and the real branch scoping all line
 * up. Module-level tests on either side can each assert their own half;
 * only a browser test spanning both can assert that the halves agree.
 *
 * ## Two contexts, not two pages
 *
 * `adminContext` and `portalContext` are separate `BrowserContext`s (see
 * the fixtures below), because the two apps' sessions genuinely collide:
 * both write a `crm_access_token` cookie, and cookies are not isolated by
 * port, so `localhost:3000` and `localhost:3002` share a cookie jar
 * within one context. Sharing a context would have the portal login
 * overwrite the admin's token (and vice versa) — the admin half of this
 * test would then be running as the portal contact. Separate contexts
 * also mean the portal reader stays signed in across the publish, which
 * is what makes Phase 3 a real "the same reader now sees it" assertion
 * rather than a fresh-login side effect.
 *
 * No `storageState`: each side signs in through its own real login form,
 * the same way `agent-resolves-ticket.spec.ts` and
 * `customer-submits-ticket.spec.ts` already do.
 *
 * ## What is seeded vs. driven through the UI
 *
 * Only the portal Contact is seeded through the API (`createPortalContactAsAdmin`,
 * the existing helper `customer-submits-ticket.spec.ts` already uses) —
 * creating a portal-enabled contact through the UI would mean clicking
 * through customer + contact + portal-password screens that have nothing
 * to do with this journey. The article itself is created AND published
 * through the real admin UI, because those two actions are the business
 * behavior under test.
 */
const WEB_BASE_URL = "http://localhost:3000";
const PORTAL_BASE_URL = "http://localhost:3002";

const test = base.extend<{ adminPage: Page; portalPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: WEB_BASE_URL });
    await use(await context.newPage());
    await context.close();
  },
  portalPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: PORTAL_BASE_URL });
    await use(await context.newPage());
    await context.close();
  },
});

/** Signs in to the Agent Workspace as the seeded admin — the same account
 * and the same form every other spec in this suite uses. */
async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL as string);
  await page.getByLabel("Password").fill(process.env.SEED_ADMIN_PASSWORD as string);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/tickets$/);
}

/** Signs in to the Customer Portal as the fixture Contact. */
async function signInToPortal(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
}

/**
 * Searches the portal Knowledge Base for one exact title and waits for
 * the result to actually settle.
 *
 * The portal's search is plain, un-debounced `useState` wired straight
 * into `usePublishedArticlesQuery`, so typing a title the browser has
 * never queried is a guaranteed cache miss -> a real request. Awaiting
 * the article link *or* the "no results" sentence is what makes both
 * phases deterministic without a sleep: whichever appears, the query has
 * demonstrably completed, so "not visible" can never be the mere absence
 * of a still-in-flight response.
 */
async function searchPortalKnowledgeBase(page: Page, title: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible();
  await page.getByLabel("Search articles").fill(title);
  await expect(
    page.getByRole("link", { name: title }).or(page.getByText("No articles match your search.")),
  ).toBeVisible();
}

test("a draft article is invisible in the portal until an agent publishes it", async ({
  adminPage,
  portalPage,
}) => {
  const articleTitle = `E2E KB Visibility ${randomUUID()}`;
  const articleBody = `Body authored by the knowledge-base visibility journey (${randomUUID()}).`;
  const contactEmail = `playwright-kb-${randomUUID()}@example.com`;
  const contactPassword = "a-strong-playwright-password-1";

  // The Contact's Customer is created by the admin, so it lands in the
  // admin's own branch — the same branch the article below is authored
  // in, which is what `listPublishedArticlesForBranch` scopes on.
  const adminToken = await loginAsAdmin();
  await createPortalContactAsAdmin(adminToken, contactEmail, contactPassword);

  // ---- Phase 1: the admin authors the article, which starts as DRAFT ----

  await signInAsAdmin(adminPage);

  await adminPage.goto("/en/knowledge-base/new");
  await adminPage.getByLabel("Title").fill(articleTitle);
  await adminPage.getByLabel("Body").fill(articleBody);
  await adminPage.getByRole("button", { name: "Create article" }).click();

  // `CreateArticleView` navigates to the real list on success, which
  // re-fetches authoritative state — so arriving here is itself the
  // proof that `POST /knowledge-base/articles` succeeded.
  await expect(adminPage).toHaveURL(/\/en\/knowledge-base$/);

  // The list is paginated and this article is brand new, so search for it
  // rather than assuming which page it landed on.
  await adminPage.getByLabel("Search articles").fill(articleTitle);
  const adminRow = adminPage.getByRole("row").filter({ hasText: articleTitle });
  await expect(adminRow).toBeVisible();
  // `exact` matters: the article detail page carries a "Published at"
  // column header, and only an exact match distinguishes the status
  // badge from it.
  await expect(adminRow.getByText("Draft", { exact: true })).toBeVisible();

  // Open the article itself and capture its real id from the URL — every
  // later assertion is pinned to this exact article rather than to a
  // title string that merely looks the same.
  await adminPage.getByRole("link", { name: articleTitle }).click();
  await expect(adminPage).toHaveURL(/\/en\/knowledge-base\/[0-9a-f-]{36}$/);
  const articleId = new URL(adminPage.url()).pathname.split("/").pop() as string;

  await expect(adminPage.getByLabel("Article title")).toHaveValue(articleTitle);
  await expect(adminPage.getByText("Draft", { exact: true })).toBeVisible();

  // ---- Phase 2: the portal reader cannot see the draft ----

  await signInToPortal(portalPage, contactEmail, contactPassword);
  await portalPage.goto("/en/knowledge-base");
  await searchPortalKnowledgeBase(portalPage, articleTitle);

  await expect(portalPage.getByText("No articles match your search.")).toBeVisible();
  await expect(portalPage.getByRole("link", { name: articleTitle })).toBeHidden();

  // The draft is not merely filtered out of the listing — it is not
  // readable by id either, which is the guarantee that matters if a
  // reader ever guesses or keeps a URL.
  await portalPage.goto(`/en/knowledge-base/${articleId}`);
  await expect(portalPage.getByText("This article could not be found.")).toBeVisible();

  // ---- Phase 3: the admin publishes it ----

  await adminPage.getByRole("button", { name: "Publish" }).click();
  await expect(adminPage.getByText("Published", { exact: true })).toBeVisible();
  await expect(adminPage.getByRole("button", { name: "Unpublish" })).toBeVisible();

  // ---- Phase 4: the same signed-in portal reader now sees it ----

  // A deterministic re-navigation rather than a sleep: a fresh page load
  // means a fresh query client, so nothing can be served from the cache
  // that was populated while the article was still a draft.
  await portalPage.goto("/en/knowledge-base");
  await searchPortalKnowledgeBase(portalPage, articleTitle);

  const portalLink = portalPage.getByRole("link", { name: articleTitle });
  await expect(portalLink).toBeVisible();

  await portalLink.click();
  await expect(portalPage).toHaveURL(`/en/knowledge-base/${articleId}`);
  await expect(portalPage.getByRole("heading", { name: articleTitle })).toBeVisible();
  await expect(portalPage.getByText(articleBody)).toBeVisible();
});
