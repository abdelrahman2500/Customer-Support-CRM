import { expect, test } from "@playwright/test";
import { loginAsAdmin, setBrandingAsAdmin } from "./support/api-client";

/**
 * Story 129 — Admin Branding & Navigation Layout Customization. The one
 * flow no unit or API-e2e test can cover: an admin changes the branch's
 * navigation layout from the existing Settings → Branding tab and the
 * Agent Workspace's own shell actually changes, in a real browser, and
 * stays changed across a reload.
 *
 * Mirrors `agent-resolves-ticket.spec.ts`'s shape — real API for setup and
 * teardown, browser only for the interaction actually under test.
 *
 * The `afterEach` restore is not optional bookkeeping: the seeded branch is
 * shared with every other spec in this suite, and leaving it on `SIDEBAR`
 * would change the workspace shell under `agent-resolves-ticket.spec.ts`,
 * which never opted into it.
 */
test.use({ baseURL: "http://localhost:3000" });

test.afterEach(async () => {
  const adminToken = await loginAsAdmin();
  await setBrandingAsAdmin(adminToken, { navigationLayout: "NAVBAR" });
});

test("an admin switches the workspace navigation to a sidebar, and it persists", async ({
  page,
}) => {
  const adminToken = await loginAsAdmin();
  // Start from the documented default, whatever a previous run left behind.
  await setBrandingAsAdmin(adminToken, { navigationLayout: "NAVBAR" });

  const email = process.env.SEED_ADMIN_EMAIL as string;
  const password = process.env.SEED_ADMIN_PASSWORD as string;

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  const nav = page.getByRole("navigation", { name: "Workspace navigation" });

  // 1. The default layout: six group menus, not a rail.
  const workspaceMenu = nav.getByRole("button", { name: "Workspace menu" });
  await expect(workspaceMenu).toBeVisible();
  await expect(nav.getByRole("button", { name: "Reporting menu" })).toBeVisible();

  // 2. Navigate through the navbar and land where it says.
  await workspaceMenu.click();
  await page.getByRole("menuitem", { name: "Customers" }).click();
  await expect(page).toHaveURL(/\/en\/customers$/);

  // 3. Switch to the sidebar from the existing Settings → Branding tab.
  await page.goto("/en/settings");
  await page.getByRole("radio", { name: "Sidebar" }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Branding saved.")).toBeVisible();

  // 4. The rail is now the workspace's navigation, and the group menus are
  //    gone — the shell swapped without a route change.
  await expect(page.getByRole("link", { name: "Tickets" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Workspace menu" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Collapse the navigation sidebar" }),
  ).toBeVisible();

  // 5. The persistence criterion: a full reload still renders the sidebar,
  //    and — because the layout is resolved server-side — with no flash of
  //    the navbar first.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Collapse the navigation sidebar" }),
  ).toBeVisible();
  await expect(nav.getByRole("button", { name: "Workspace menu" })).toHaveCount(0);

  // 6. Navigate via the sidebar; the destination's own item is current.
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page).toHaveURL(/\/en\/reports$/);
  await expect(page.getByRole("link", { name: "Reports" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // 7. Permission visibility is unchanged: the full destination list is
  //    still rendered, exactly as in the navbar. This story introduced no
  //    client-side gating.
  //
  //    Located by `href` rather than by accessible name: the notifications
  //    item carries Story 92's unread-count badge inside the link, so its
  //    accessible name is "Notification History" plus a number whenever the
  //    seeded branch happens to have unread notifications. `toContainText`
  //    then still proves the label itself rendered.
  const EXPECTED_ITEMS: Array<[href: string, label: string]> = [
    ["dashboard", "Dashboard"],
    ["tickets", "Tickets"],
    ["customers", "Customers"],
    ["knowledge-base", "Knowledge Base"],
    ["kb-categories", "KB Categories"],
    ["notifications", "Notification History"],
    ["sla-policies", "SLA Policies"],
    ["ticket-categories", "Ticket Categories"],
    ["automation-rules", "Automation Rules"],
    ["quick-replies", "Quick Replies"],
    ["reports", "Reports"],
    ["audit-logs", "Audit Log"],
    ["branches", "My Branch"],
    ["users", "Users"],
    ["roles", "Roles & Permissions"],
    ["notification-templates", "Notification Templates"],
    ["webhook-subscriptions", "Webhook Subscriptions"],
    ["api-keys", "API Keys"],
    ["settings", "Settings"],
    ["my-sessions", "My Sessions"],
  ];
  for (const [href, label] of EXPECTED_ITEMS) {
    const link = nav.locator(`a[href="/en/${href}"]`);
    await expect(link, href).toBeVisible();
    await expect(link, href).toContainText(label);
  }
  await expect(nav.locator("a")).toHaveCount(EXPECTED_ITEMS.length);

  // A11Y-3 — the skip link is still the page's own first focusable element
  // and still targets `#main-content`, which the sidebar branch now puts a
  // whole rail ahead of in DOM order.
  await expect(page.locator('a[href="#main-content"]')).toHaveText("Skip to main content");
  await expect(page.locator("#main-content")).toBeVisible();
});
