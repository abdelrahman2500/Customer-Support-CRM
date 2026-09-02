import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createTicketAsAdmin, loginAsAdmin } from "./support/api-client";

/**
 * Story 114 — the first of the two critical flows
 * docs/architecture/11-quality-and-operations.md names: "an agent
 * resolves a ticket." Fixture ticket is created via the real API (see
 * `support/api-client.ts`'s own doc comment for why), scoped to the
 * seeded admin's own branch; the browser interaction under test is
 * strictly: sign in, find the ticket, change its status to `RESOLVED`.
 */
test.use({ baseURL: "http://localhost:3000" });

test("an agent signs in, opens a ticket, and resolves it", async ({ page }) => {
  const subject = `Playwright — cannot access account ${randomUUID()}`;
  const adminToken = await loginAsAdmin();
  await createTicketAsAdmin(adminToken, subject);

  const email = process.env.SEED_ADMIN_EMAIL as string;
  const password = process.env.SEED_ADMIN_PASSWORD as string;

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  await page.getByText(subject).click();
  await expect(page).toHaveURL(/\/tickets\/[^/]+$/);

  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "RESOLVED", exact: true }).click();

  await expect(page.getByLabel("Status")).toHaveText("RESOLVED");
});
