import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  createAgentAsAdmin,
  createPortalContactWithTicketAsAdmin,
  getMyFullName,
  loginAsAdmin,
} from "./support/api-client";

/**
 * Final UX pass — signing out and in as someone else in the same tab, with
 * no reload, shows the new person's name, navigation and data at once, and
 * never the previous person's. The signed-in layout is a server component
 * that renders the user; before the fix, the Next.js client Router Cache
 * served the previous session's copy of it after a client-side sign-in, so
 * an agent saw the admin's name and menus (and the admin the agent's).
 */
const WEB = "http://localhost:3000";
const PORTAL = "http://localhost:3002";
const PASSWORD = "Playwright!Switch1";

async function signIn(page: Page, base: string, email: string, password: string) {
  await page.goto(`${base}/en/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /Account menu for/ }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Signs in from the login page the sign-out landed on — a client-side
 * navigation, the path that used to reuse the previous session. */
async function signInFromHere(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("switching between an admin and an agent in one tab shows only the current person", async ({
  page,
}) => {
  const adminToken = await loginAsAdmin();
  const adminName = await getMyFullName(adminToken);
  const agentEmail = `playwright-agent-${randomUUID()}@example.com`;
  const agentName = `Playwright Agent ${randomUUID().slice(0, 8)}`;
  await createAgentAsAdmin(adminToken, {
    email: agentEmail,
    password: PASSWORD,
    fullName: agentName,
  });

  const forbidden: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 403) forbidden.push(response.url());
  });
  const insights = () => page.getByRole("navigation").getByRole("button", { name: /^Insights/ });

  // Admin → Agent.
  await signIn(
    page,
    WEB,
    process.env.SEED_ADMIN_EMAIL as string,
    process.env.SEED_ADMIN_PASSWORD as string,
  );
  await expect(page.getByRole("button", { name: `Account menu for ${adminName}` })).toBeVisible();
  await expect(insights()).toBeVisible();
  await signOut(page);
  await signInFromHere(page, agentEmail, PASSWORD);
  await expect(page.getByRole("button", { name: `Account menu for ${agentName}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Account menu for ${adminName}` })).toHaveCount(0);
  await expect(insights()).toHaveCount(0);

  // Agent → Admin.
  await signOut(page);
  await signInFromHere(
    page,
    process.env.SEED_ADMIN_EMAIL as string,
    process.env.SEED_ADMIN_PASSWORD as string,
  );
  await expect(page.getByRole("button", { name: `Account menu for ${adminName}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Account menu for ${agentName}` })).toHaveCount(0);
  await expect(insights()).toBeVisible();

  // The agent's session never asked for what only the admin may read.
  expect(forbidden).toEqual([]);
});

test("switching between two portal contacts in one tab shows only the current contact's tickets", async ({
  page,
}) => {
  const adminToken = await loginAsAdmin();
  const first = {
    email: `playwright-switch-a-${randomUUID()}@example.com`,
    subject: `Switch A ${randomUUID()}`,
  };
  const second = {
    email: `playwright-switch-b-${randomUUID()}@example.com`,
    subject: `Switch B ${randomUUID()}`,
  };
  await createPortalContactWithTicketAsAdmin(adminToken, { ...first, password: PASSWORD });
  await createPortalContactWithTicketAsAdmin(adminToken, { ...second, password: PASSWORD });

  await signIn(page, PORTAL, first.email, PASSWORD);
  await page.goto(`${PORTAL}/en/tickets`);
  await expect(page.getByText(first.subject)).toBeVisible();
  await signOut(page);
  await signInFromHere(page, second.email, PASSWORD);
  // A client-side navigation, the path that used to reuse the last session.
  await page.getByRole("link", { name: "My Tickets" }).first().click();
  await expect(page.getByText(second.subject)).toBeVisible();
  await expect(page.getByText(first.subject)).toHaveCount(0);
});
