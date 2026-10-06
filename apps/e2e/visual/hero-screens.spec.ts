/// <reference lib="dom" />
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Story 234 (PR-7.1) — screenshots of the hero screens: the two logins, the
 * board, a ticket, the dashboard, and the portal's home and ticket — in
 * English and Arabic, light and dark, at 1280 and 390 wide. Local only
 * (PD-9); see `playwright.visual.config.ts` for how to run and re-baseline.
 *
 * Signs in as the demo dataset's users (`prisma/seed-demo.ts`), whose
 * password comes from `DEMO_USER_PASSWORD`, exactly as the seed takes it.
 */
const WEB = "http://localhost:3000";
const PORTAL = "http://localhost:3002";
const API = "http://localhost:3001/api/v1";
const PASSWORD = process.env.DEMO_USER_PASSWORD;
const AGENT = "sara@demo.example";
const CONTACT = "layla@desert-rose.demo.example";
/** A demo ticket owned by the demo contact, so both apps can open it. */
const TICKET_SUBJECT = "Charged twice for the annual renewal";

test.skip(!PASSWORD, "DEMO_USER_PASSWORD is required (the demo dataset's password)");

const VARIANTS = [
  { locale: "en", theme: "light" },
  { locale: "en", theme: "dark" },
  { locale: "ar", theme: "light" },
  { locale: "ar", theme: "dark" },
] as const;
const WIDTHS = [1280, 390] as const;

/**
 * The demo data's timestamps move with each seed, so every digit on the
 * page (dates, times, durations, counts) becomes "0" before a capture: the
 * layout and every word are compared, the clock is not.
 */
async function normaliseDigits(page: Page) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (/\d/.test(node.nodeValue ?? "")) node.nodeValue = node.nodeValue!.replace(/\d/g, "0");
    }
  });
}

async function signIn(page: Page, base: string, email: string) {
  await page.goto(`${base}/en/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

async function bearer(page: Page, cookie: string): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === cookie)?.value ?? "";
}

async function context(browser: Browser, theme: string, width: number) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme as "light" | "dark",
  });
  await ctx.addCookies([
    { name: "crm-theme", value: theme, url: WEB },
    { name: "crm-theme", value: theme, url: PORTAL },
  ]);
  return ctx;
}

async function capture(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await normaliseDigits(page);
  await expect(page).toHaveScreenshot(`${name}.png`);
}

for (const { locale, theme } of VARIANTS) {
  for (const width of WIDTHS) {
    const tag = `${locale}-${theme}-${width}`;

    test(`logins ${tag}`, async ({ browser }) => {
      const ctx = await context(browser, theme, width);
      const page = await ctx.newPage();
      await page.goto(`${WEB}/${locale}/login`);
      await capture(page, `web-login-${tag}`);
      await page.goto(`${PORTAL}/${locale}/login`);
      await capture(page, `portal-login-${tag}`);
      await ctx.close();
    });

    test(`agent workspace ${tag}`, async ({ browser }) => {
      const ctx = await context(browser, theme, width);
      const page = await ctx.newPage();
      await signIn(page, WEB, AGENT);
      const token = await bearer(page, "crm_access_token");
      const search = await page.request.get(
        `${API}/tickets?search=${encodeURIComponent(TICKET_SUBJECT)}&pageSize=1`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const ticketId = (await search.json()).items[0].id as string;

      await page.goto(`${WEB}/${locale}/dashboard`);
      await capture(page, `web-dashboard-${tag}`);
      await page.goto(`${WEB}/${locale}/tickets?view=board`);
      await capture(page, `web-board-${tag}`);
      await page.goto(`${WEB}/${locale}/tickets/${ticketId}`);
      await capture(page, `web-ticket-${tag}`);
      await ctx.close();
    });

    test(`customer portal ${tag}`, async ({ browser }) => {
      const ctx = await context(browser, theme, width);
      const page = await ctx.newPage();
      await signIn(page, PORTAL, CONTACT);
      const token = await bearer(page, "crm_portal_access_token");
      const search = await page.request.get(
        `${API}/portal/tickets?search=${encodeURIComponent(TICKET_SUBJECT)}&pageSize=1`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const ticketId = (await search.json()).items[0].id as string;

      await page.goto(`${PORTAL}/${locale}/home`);
      await capture(page, `portal-home-${tag}`);
      await page.goto(`${PORTAL}/${locale}/tickets/${ticketId}`);
      await capture(page, `portal-ticket-${tag}`);
      await ctx.close();
    });
  }
}
