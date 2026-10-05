import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  createTicketAsAdmin,
  getTicketStatusAsAdmin,
  loginAsAdmin,
  setTicketStatusAsAdmin,
} from "./support/api-client";

/**
 * Story 218 (PR-3.3, tickets-kanban-ux.md §5, §6, §11) — an agent moves a
 * ticket across the Tickets board with each path the spec names, and the
 * board stays honest about other people's changes:
 *
 * 1. the card's "Move to" menu (focus follows the card);
 * 2. the keyboard drag on its handle (←/→ between columns);
 * 3. a move into Resolved waits on the confirm — Escape sends nothing;
 * 4. a move that overrides someone else's change says so;
 * 5. a change made elsewhere arrives on focus refetch, with the change cue.
 *
 * Every move is checked against the API, not only the screen.
 */
test.use({ baseURL: "http://localhost:3000" });

function column(page: Page, name: string) {
  return page.getByRole("region", { name: new RegExp(`^${name},`) });
}

/** A keyboard drag on the focused handle, step by step as a screen-reader
 * user hears it: picked up, over each column, then dropped. */
async function keyboardDrag(page: Page, subject: string, key: string, over: string[]) {
  await page.keyboard.press("Space");
  await expect(page.getByText(`Picked up ${subject}.`, { exact: false })).toBeAttached();
  for (const status of over) {
    await page.keyboard.press(key);
    await expect(page.getByText(`${subject} is over ${status}.`)).toBeAttached();
  }
  await page.keyboard.press("Space");
}

test("an agent moves a ticket across the board by menu, keyboard and confirm", async ({ page }) => {
  const subject = `Playwright board move ${randomUUID()}`;
  const adminToken = await loginAsAdmin();
  const { ticketId } = await createTicketAsAdmin(adminToken, subject);
  const status = () => getTicketStatusAsAdmin(adminToken, ticketId);

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL as string);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD as string);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  // The board is the default view; narrow it to this ticket.
  await expect(page.getByRole("region", { name: "Tickets board" })).toBeVisible();
  const search = page.getByPlaceholder("Search by subject or category...");
  await search.fill(subject);
  await search.blur();
  await expect(column(page, "Open").getByText(subject)).toBeVisible();

  // 1. Menu: Open → In progress, immediately; focus lands on the moved card.
  await page.getByRole("button", { name: `Actions for ${subject}` }).click();
  await page.getByRole("menuitem", { name: "In progress" }).click();
  await expect(column(page, "In progress").getByText(subject)).toBeVisible();
  await expect(page.getByRole("button", { name: `Move ${subject}` })).toBeFocused();
  await expect.poll(status).toBe("IN_PROGRESS");

  // 2. Keyboard drag: back to Open (one column toward the start).
  await keyboardDrag(page, subject, "ArrowLeft", ["Open"]);
  await expect(column(page, "Open").getByText(subject)).toBeVisible();
  await expect(page.getByText(`Moved ${subject} to Open.`)).toBeAttached();
  await expect.poll(status).toBe("OPEN");

  // 3. Keyboard drag two columns to Resolved: the confirm opens on its
  //    action; Escape leaves the card where it was and sends nothing.
  await page.getByRole("button", { name: `Move ${subject}` }).focus();
  await keyboardDrag(page, subject, "ArrowRight", ["In progress", "Resolved"]);
  const confirm = page.getByRole("dialog");
  await expect(confirm).toContainText("Resolve this ticket? The customer is notified.");
  await expect(confirm.getByRole("button", { name: "Resolve" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(column(page, "Open").getByText(subject)).toBeVisible();
  expect(await status()).toBe("OPEN");

  // …and confirming resolves it.
  await page.getByRole("button", { name: `Actions for ${subject}` }).click();
  await page.getByRole("menuitem", { name: "Resolved" }).click();
  await confirm.getByRole("button", { name: "Resolve" }).click();
  await expect(column(page, "Resolved").getByText(subject)).toBeVisible();
  await expect.poll(status).toBe("RESOLVED");

  // 4. Someone else reopens it behind the board's back; moving it again
  //    still applies (last write wins) and says so.
  await setTicketStatusAsAdmin(adminToken, ticketId, "IN_PROGRESS");
  await page.getByRole("button", { name: `Actions for ${subject}` }).click();
  await page.getByRole("menuitem", { name: "Open" }).click();
  await expect(
    page.getByText("This ticket was also changed by someone else; your move was applied."),
  ).toBeVisible();
  await expect.poll(status).toBe("OPEN");
});

test("a change made elsewhere reaches the board on focus, with the change cue", async ({
  page,
}) => {
  const subject = `Playwright board freshness ${randomUUID()}`;
  const adminToken = await loginAsAdmin();
  const { ticketId } = await createTicketAsAdmin(adminToken, subject);

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL as string);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD as string);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  const search = page.getByPlaceholder("Search by subject or category...");
  await search.fill(subject);
  await search.blur();
  await expect(column(page, "Open").getByText(subject)).toBeVisible();

  // Another agent starts work on it; the board learns of it when the window
  // regains focus (no realtime broadcast — PD-4 deferred).
  await setTicketStatusAsAdmin(adminToken, ticketId, "IN_PROGRESS");
  // A string expression: this package type-checks without the DOM library.
  await page.evaluate("window.dispatchEvent(new Event('visibilitychange'))");
  const moved = column(page, "In progress").locator("[data-changed]", { hasText: subject });
  await expect(moved).toBeVisible();
  await expect(column(page, "Open").getByText(subject)).toBeHidden();
});
