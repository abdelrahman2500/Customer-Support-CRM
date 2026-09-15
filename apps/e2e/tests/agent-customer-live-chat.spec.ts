import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";
import { createPortalContactWithTicketAsAdmin, loginAsAdmin } from "./support/api-client";

/**
 * P1-2 Journey 2 — Agent <-> Customer Live Chat.
 *
 * Story 77 built the two-audience `ticket:{id}` room and Story 78 built
 * the chat UI on both sides, but every test of them so far has been
 * single-process: the gateway's own spec asserts authorization, and each
 * app's hook spec asserts its merge behavior against a fake socket.
 * Nothing proved the pieces actually meet — that a message written by a
 * Contact in `apps/portal` traverses the real `POST`, the real
 * `channel.message.created` domain event, `TicketRealtimeListener`, the
 * real Socket.IO server (with its Redis adapter) and lands in a *different
 * browser's* already-open agent page, and back again.
 *
 * ## Why this is a genuine realtime proof, not a disguised refetch
 *
 * Both apps' `QueryProvider`s set `refetchOnWindowFocus: false`, neither
 * messages query sets a `refetchInterval`, and both realtime hooks handle
 * `channel.message.created` by *merging the payload into the cache*
 * (`mergeChannelMessage`) rather than invalidating and re-fetching. So on
 * a page that is never reloaded, never navigated, and never refocused into
 * a refetch, there is exactly one code path by which a message the other
 * party wrote can appear: the socket event. The test never reloads,
 * navigates, or calls the messages API after a send — if the socket path
 * were broken, no timeout would rescue these assertions.
 *
 * ## Why the assertions are cross-page
 *
 * Each composer clears its own textarea on success and each send mutation
 * seeds the sender's own cache, so a sender always sees its own message
 * regardless of realtime. Every delivery assertion below therefore runs on
 * the *receiving* page: the customer's message is asserted on the agent's
 * page, and the agent's reply on the customer's page.
 *
 * ## Two contexts, both alive throughout
 *
 * `agentContext` and `portalContext` are separate `BrowserContext`s (the
 * fixtures below), which is required rather than tidy: both apps write a
 * `crm_access_token` cookie and cookies are not isolated by port, so one
 * shared context would have the portal login overwrite the agent's token.
 * Both stay open for the whole exchange — that is what makes "the agent's
 * already-open page updated" a meaningful claim.
 */
const WEB_BASE_URL = "http://localhost:3000";
const PORTAL_BASE_URL = "http://localhost:3002";

const test = base.extend<{ agentPage: Page; customerPage: Page }>({
  agentPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: WEB_BASE_URL });
    await use(await context.newPage());
    await context.close();
  },
  customerPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: PORTAL_BASE_URL });
    await use(await context.newPage());
    await context.close();
  },
});

/**
 * Resolves once this page's Socket.IO client has actually emitted its
 * `join` for `ticket:{id}` over the wire.
 *
 * This is the one synchronization point that genuinely matters: a room
 * join that has not happened yet cannot be recovered by waiting later,
 * because `ticket:{id}` has no event replay — a message emitted before a
 * socket is in the room is missed permanently, and the test would fail
 * rather than flake. Observing the real WebSocket frame is possible here
 * precisely because `realtime-connection.ts` pins `transports:
 * ["websocket"]`, so there is no HTTP-polling phase that would carry the
 * join invisibly to Playwright.
 *
 * Must be called *before* the navigation that mounts the ticket page, so
 * the `websocket` event cannot be missed.
 */
function waitForTicketRoomJoin(page: Page, ticketId: string): Promise<void> {
  return new Promise<void>((resolve) => {
    page.on("websocket", (ws) => {
      ws.on("framesent", (frame) => {
        if (frame.payload.includes(`"join"`) && frame.payload.includes(`ticket:${ticketId}`)) {
          resolve();
        }
      });
    });
  });
}

/** Signs in to the Agent Workspace as the seeded admin — same account and
 * same form every other spec in this suite uses. */
async function signInAsAgent(page: Page): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(process.env.SEED_ADMIN_EMAIL as string);
  await page.getByLabel("Password").fill(process.env.SEED_ADMIN_PASSWORD as string);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/tickets$/);
}

/** Signs in to the Customer Portal as the fixture Contact. */
async function signInAsCustomer(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/home$/);
}

/**
 * Types a message and sends it, then waits for the application's own
 * "send completed" state rather than a timer: both composers clear the
 * textarea only after `mutateAsync` resolves, and re-enable the disabled
 * Send button at the same point. An empty textarea is therefore proof
 * that the real `POST` returned 2xx.
 */
async function sendChatMessage(page: Page, body: string): Promise<void> {
  const composer = page.getByLabel("Type a message...");
  await composer.fill(body);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(composer).toHaveValue("");
}

/** The conversation list itself (`<ol aria-label="Live Chat">`), so a
 * delivery assertion is scoped to the rendered message list and cannot be
 * satisfied by the same text sitting in a composer or anywhere else. */
function conversation(page: Page) {
  return page.getByRole("list", { name: "Live Chat" });
}

test("a customer and an agent exchange live messages on the same ticket", async ({
  agentPage,
  customerPage,
}) => {
  const subject = `E2E Live Chat ${randomUUID()}`;
  const contactEmail = `playwright-chat-${randomUUID()}@example.com`;
  const contactPassword = "a-strong-playwright-password-1";
  const customerMessage = `Customer message ${randomUUID()}`;
  const agentReply = `Agent reply ${randomUUID()}`;

  // One ticket, owned by the same Customer the portal Contact belongs to —
  // both portal authorization rules (REST scoping and room authorization)
  // resolve that Contact -> Customer -> Ticket link.
  const adminToken = await loginAsAdmin();
  const { ticketId } = await createPortalContactWithTicketAsAdmin(adminToken, {
    email: contactEmail,
    password: contactPassword,
    subject,
  });

  // ---- Both parties open the same ticket ----

  await signInAsAgent(agentPage);
  const agentJoined = waitForTicketRoomJoin(agentPage, ticketId);
  await agentPage.goto(`/en/tickets/${ticketId}`);
  await expect(agentPage).toHaveURL(`/en/tickets/${ticketId}`);
  await expect(agentPage.getByRole("heading", { name: subject })).toBeVisible();
  // The conversation is empty and the composer is ready: the detail view is
  // mounted, so its `useTicketRealtime` effect has run.
  await expect(agentPage.getByText("No messages yet.")).toBeVisible();
  await agentJoined;

  await signInAsCustomer(customerPage, contactEmail, contactPassword);
  const customerJoined = waitForTicketRoomJoin(customerPage, ticketId);
  await customerPage.goto(`/en/tickets/${ticketId}`);
  await expect(customerPage).toHaveURL(`/en/tickets/${ticketId}`);
  await expect(customerPage.getByRole("heading", { name: subject })).toBeVisible();
  await expect(customerPage.getByText("No messages yet.")).toBeVisible();
  await customerJoined;

  // ---- Phase 1: customer -> POST -> Socket.IO -> agent ----

  await sendChatMessage(customerPage, customerMessage);

  // Asserted on the agent's page, which has not been reloaded, navigated,
  // or refetched since it was opened above.
  await expect(conversation(agentPage).getByText(customerMessage)).toBeVisible();
  // The agent's side attributes it to the customer (an INBOUND message),
  // not to an agent — a delivery that arrived with the wrong direction
  // would render under "You"/"Agent" instead.
  await expect(
    conversation(agentPage).locator("li").filter({ hasText: customerMessage }),
  ).toContainText("Customer");

  // ---- Phase 2: agent -> POST -> Socket.IO -> customer ----

  await sendChatMessage(agentPage, agentReply);

  await expect(conversation(customerPage).getByText(agentReply)).toBeVisible();
  await expect(
    conversation(customerPage).locator("li").filter({ hasText: agentReply }),
  ).toContainText("Agent");

  // Both conversations converge on the same two messages, in the same
  // order — neither side is missing the other's, and neither duplicated
  // its own (the room broadcast echoes back to the sender too, which
  // `mergeChannelMessage` upserts by id).
  for (const page of [agentPage, customerPage]) {
    await expect(conversation(page).locator("li")).toHaveCount(2);
  }
  await expect(conversation(agentPage).locator("li").nth(0)).toContainText(customerMessage);
  await expect(conversation(agentPage).locator("li").nth(1)).toContainText(agentReply);
  await expect(conversation(customerPage).locator("li").nth(0)).toContainText(customerMessage);
  await expect(conversation(customerPage).locator("li").nth(1)).toContainText(agentReply);
});
