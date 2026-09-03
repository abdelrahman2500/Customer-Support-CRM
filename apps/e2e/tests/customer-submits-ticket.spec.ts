import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createPortalContactAsAdmin, loginAsAdmin } from "./support/api-client";

/**
 * Story 114 — the second of the two critical flows
 * docs/architecture/11-quality-and-operations.md names: "a customer
 * submits one through the portal." Fixture Contact (portal-enabled) is
 * created via the real API (see `support/api-client.ts`'s own doc
 * comment for why); the browser interaction under test is strictly: sign
 * in to the portal, fill in the inline "Submit a new ticket" form
 * (`CreateTicketForm`, `apps/portal/src/components/tickets/ticket-list-view.tsx`),
 * submit, and see it appear in "My Tickets".
 */
test.use({ baseURL: "http://localhost:3002" });

test("a customer signs in to the portal and submits a new ticket", async ({ page }) => {
  const contactEmail = `playwright-portal-${randomUUID()}@example.com`;
  const contactPassword = "a-strong-playwright-password-1";
  const subject = `Playwright — my order has not arrived ${randomUUID()}`;

  const adminToken = await loginAsAdmin();
  await createPortalContactAsAdmin(adminToken, contactEmail, contactPassword);

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(contactEmail);
  await page.getByLabel("Password").fill(contactPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/en/tickets");
  await page.getByLabel("Subject").fill(subject);
  await page.getByRole("button", { name: "Submit ticket" }).click();

  // The success toast (Story 94) auto-dismisses after 5s — the durable
  // proof of success is the new ticket actually appearing in the list
  // below, not the transient toast.
  await expect(page.getByText(subject)).toBeVisible();
});
