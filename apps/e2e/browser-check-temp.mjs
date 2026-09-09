import { chromium } from "@playwright/test";

const BASE = "http://localhost:3010";
const EMAIL = "admin@example.com";
const PASSWORD = "dev-only-admin-password-change-me-32ch";

function log(...args) {
  console.log(new Date().toISOString().slice(11, 23), ...args);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") log("[console.error]", msg.text());
  });
  page.on("pageerror", (err) => log("[pageerror]", err.message));
  page.on("response", async (res) => {
    if (res.url().includes("localhost:3001")) {
      let body = "";
      try {
        body = await res.text();
      } catch (error) {
        void error;
      }
      log("[response]", res.status(), res.url(), body.slice(0, 300));
    }
  });
  page.on("request", (req) => {
    if (req.url().includes("localhost:3001")) log("[request]", req.method(), req.url());
  });
  page.on("requestfailed", (req) => log("[requestfailed]", req.url(), req.failure()?.errorText));

  // --- 1. Login ---
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle" });
  // Belt-and-suspenders against clicking before React hydrates and attaches
  // the form's onSubmit handler (confirmed: doing so falls through to a
  // native GET form-submit, silently reloading the page with empty
  // fields — a test-script timing bug, not an app bug).
  await page
    .waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]');
      return (
        (btn && btn.onclick !== null) || document.querySelector("form")?.onsubmit !== undefined
      );
    })
    .catch(() => {});
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.screenshot({
    path: "C:/Users/USER/AppData/Local/Temp/claude/e--Algoriza-Customer-Support-CRM/806cf213-bf91-42ca-a5ca-c0f74b984be8/scratchpad/00-login-filled.png",
  });

  // --- Check patch state BEFORE any navigation happens ---
  const prePatchState = await page.evaluate(() => ({
    pushStateSrc: window.history.pushState.toString().slice(0, 120),
    hasMarker: Boolean(window.history.pushState.__navOverlay),
  }));
  log("BEFORE login-submit pushState state:", JSON.stringify(prePatchState));

  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  log("3s after click, url:", page.url());
  await page.screenshot({
    path: "C:/Users/USER/AppData/Local/Temp/claude/e--Algoriza-Customer-Support-CRM/806cf213-bf91-42ca-a5ca-c0f74b984be8/scratchpad/00b-after-click.png",
  });
  if (!/\/en\/tickets/.test(page.url())) {
    await page.waitForURL(/\/en\/tickets/, { timeout: 15000 });
  }
  log("Logged in, landed on:", page.url());

  // --- Check the listener/patch state now that we're in the authenticated shell ---
  const postLoginState = await page.evaluate(() => {
    const statusEls = Array.from(document.querySelectorAll('[role="status"]'));
    return {
      pushStateSrc: window.history.pushState.toString().slice(0, 200),
      hasMarker: Boolean(window.history.pushState.__navOverlay),
      statusElCount: statusEls.length,
      statusElsInfo: statusEls.map((el) => ({
        ariaBusy: el.getAttribute("aria-busy"),
        ariaLive: el.getAttribute("aria-live"),
        text: el.textContent,
        hasFixedBackdrop: Boolean(el.querySelector(".fixed.inset-0")),
      })),
    };
  });
  log("AFTER login, mount/patch state:", JSON.stringify(postLoginState, null, 2));

  await page.screenshot({
    path: "C:/Users/USER/AppData/Local/Temp/claude/e--Algoriza-Customer-Support-CRM/806cf213-bf91-42ca-a5ca-c0f74b984be8/scratchpad/01-tickets.png",
  });

  // --- 2. Set up a rapid poller BEFORE clicking a nav link, then click ---
  async function clickAndObserve(label, action) {
    const samples = [];
    const startedAt = Date.now();
    let stopped = false;
    const pollPromise = (async () => {
      while (!stopped && Date.now() - startedAt < 4000) {
        const info = await page
          .evaluate(() => {
            const el = Array.from(document.querySelectorAll('[role="status"]')).find(
              (e) => e.querySelector(".fixed.inset-0") || e.getAttribute("aria-busy") !== null,
            );
            return el
              ? {
                  t: performance.now(),
                  ariaBusy: el.getAttribute("aria-busy"),
                  hasBackdrop: Boolean(el.querySelector(".fixed.inset-0")),
                }
              : { t: performance.now(), ariaBusy: null, hasBackdrop: false };
          })
          .catch(() => null);
        if (info) samples.push({ elapsed: Date.now() - startedAt, ...info });
        await new Promise((r) => setTimeout(r, 15));
      }
    })();

    await action();
    // Let the poller keep running a bit after navigation to observe clearing.
    await new Promise((r) => setTimeout(r, 2500));
    stopped = true;
    await pollPromise;

    const busyTrueSamples = samples.filter((s) => s.ariaBusy === "true");
    log(
      `[${label}] samples=${samples.length}, first aria-busy=true at elapsed=${
        busyTrueSamples[0]?.elapsed ?? "NEVER"
      }ms, last aria-busy=true at elapsed=${
        busyTrueSamples[busyTrueSamples.length - 1]?.elapsed ?? "N/A"
      }ms, final url=${page.url()}`,
    );
    return samples;
  }

  // --- A -> B via <Link> click (WorkspaceNav) ---
  await clickAndObserve("Link: Tickets -> Customers", async () => {
    await page.click('nav a:has-text("Customers")');
  });
  await page.screenshot({
    path: "C:/Users/USER/AppData/Local/Temp/claude/e--Algoriza-Customer-Support-CRM/806cf213-bf91-42ca-a5ca-c0f74b984be8/scratchpad/02-customers.png",
  });

  // --- B -> A via <Link> click ---
  await clickAndObserve("Link: Customers -> Tickets", async () => {
    await page.click('nav a:has-text("Tickets")');
  });

  // --- back/forward ---
  await clickAndObserve("Browser back (Tickets -> Customers via history)", async () => {
    await page.click('nav a:has-text("Customers")');
    await page.waitForTimeout(500);
  });
  await clickAndObserve("Browser back button", async () => {
    await page.goBack();
  });

  // --- router.push via row click (dashboard -> ticket detail), if a ticket exists ---
  await page.goto(`${BASE}/en/tickets`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const rowCount = await page
    .locator("table tbody tr")
    .count()
    .catch(() => 0);
  log("ticket rows found:", rowCount);
  if (rowCount > 0) {
    await clickAndObserve("router.push via ticket row click", async () => {
      await page.locator("table tbody tr").first().click();
    });
    await page.screenshot({
      path: "C:/Users/USER/AppData/Local/Temp/claude/e--Algoriza-Customer-Support-CRM/806cf213-bf91-42ca-a5ca-c0f74b984be8/scratchpad/03-ticket-detail.png",
    });
  }

  await browser.close();
  log("DONE");
}

main().catch((err) => {
  console.error("SCRIPT FAILED:", err);
  process.exit(1);
});
