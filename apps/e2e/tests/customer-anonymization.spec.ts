import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";
import { createPortalContactWithTicketAsAdmin, loginAsAdmin } from "./support/api-client";

/**
 * Story 132 — Customer Data Anonymization / Right-to-Erasure.
 *
 * The one claim no single-surface test can make: an admin anonymizing a
 * customer in `apps/web` actually cuts that person out of `apps/portal`,
 * while the ticket they raised stays readable to the agent. Three separate
 * guarantees meet here — the transactional service write, the portal's own
 * `passwordHash` authentication check, and the `RESTRICT` foreign key that
 * keeps ticket history from being cascaded away — and only a browser test
 * spanning both apps shows they agree.
 *
 * ## Why history retention is asserted, not assumed
 *
 * This story deliberately does NOT delete anything: `tickets.customer_id`
 * is `RESTRICT NOT NULL`, and six related relations are `CASCADE`, so a
 * hard delete would either be refused outright or silently destroy notes,
 * attachments, notification logs and AI chat sessions. The final phase
 * below opens the ticket as the agent *after* anonymization precisely to
 * prove the history survived — a regression that cascaded it away would
 * fail here rather than in production.
 *
 * ## Two contexts, both real logins
 *
 * Separate `BrowserContext`s because both apps write a `crm_access_token`
 * cookie and cookies are not isolated by port — one shared context would
 * have the portal login overwrite the admin's token. No `storageState`:
 * the portal contact's ability to authenticate is exactly what the middle
 * phase measures, so it has to be a real login both times.
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

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL as string);
  await page.getByLabel("Password").fill(process.env.SEED_ADMIN_PASSWORD as string);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/tickets$/);
}

async function submitPortalLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("an admin anonymizes a customer, portal access stops, and ticket history survives", async ({
  adminPage,
  portalPage,
}) => {
  const subject = `E2E Anonymization ${randomUUID()}`;
  const contactEmail = `playwright-anon-${randomUUID()}@example.com`;
  const contactPassword = "a-strong-playwright-password-1";

  const adminToken = await loginAsAdmin();
  const { customerId, ticketId } = await createPortalContactWithTicketAsAdmin(adminToken, {
    email: contactEmail,
    password: contactPassword,
    subject,
  });

  // ---- Phase 1: the contact can reach the portal today ----

  await submitPortalLogin(portalPage, contactEmail, contactPassword);
  await expect(portalPage).toHaveURL(/\/en\/home$/);

  // ---- Phase 2: the admin anonymizes the customer through the real UI ----

  await signInAsAdmin(adminPage);
  await adminPage.goto(`/en/customers/${customerId}`);
  await expect(adminPage).toHaveURL(`/en/customers/${customerId}`);

  const anonymizeButton = adminPage.getByRole("button", { name: "Anonymize customer" });
  await expect(anonymizeButton).toBeVisible();
  await anonymizeButton.click();

  // Guarded by a confirmation dialog — an irreversible action never commits
  // on the first click.
  const dialog = adminPage.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Anonymize customer" }).click();

  // The screen now shows the durable anonymized state and no longer offers
  // the action, which is also how we know the mutation resolved.
  await expect(adminPage.getByText("Anonymized", { exact: true })).toBeVisible();
  await expect(adminPage.getByRole("button", { name: "Anonymize customer" })).toBeHidden();

  // ---- Phase 3: the same person can no longer get into the portal ----

  // A fresh login attempt with the exact credentials that worked in Phase 1.
  // The password hash is gone, so this must not reach the portal home.
  await submitPortalLogin(portalPage, contactEmail, contactPassword);
  await expect(portalPage).toHaveURL(/\/en\/login/);
  await expect(portalPage).not.toHaveURL(/\/en\/home$/);

  // ---- Phase 4: the ticket history is still there for the agent ----

  await adminPage.goto(`/en/tickets/${ticketId}`);
  await expect(adminPage).toHaveURL(`/en/tickets/${ticketId}`);
  // The ticket kept its own subject — it was neither deleted nor scrubbed.
  await expect(adminPage.getByRole("heading", { name: subject })).toBeVisible();
});
