import { randomUUID } from "node:crypto";

/**
 * Story 114 — a thin `fetch`-based helper for seeding fixture data
 * directly against the real, running `apps/api` before a test drives the
 * browser — the same "seed via the real API, never a direct DB write"
 * discipline `apps/api/test/*.e2e-spec.ts` already established (e.g.
 * `portal-knowledge-base.e2e-spec.ts`'s own doc comment). Keeps each
 * Playwright test focused on the one UI interaction it actually exists to
 * verify, rather than also clicking through ticket/customer creation
 * forms that are already covered by unit and API-e2e tests.
 */
const API_BASE_URL = "http://localhost:3001/api/v1";

async function apiFetch<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status}: ${body}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

/** Logs in as the seeded admin (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` —
 * the same account every `apps/api/test/*.e2e-spec.ts` file uses). */
export async function loginAsAdmin(): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must be set for the e2e suite to run");
  }
  const { accessToken } = await apiFetch<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return accessToken;
}

/** Creates a ticket (with its own dedicated Customer) as the admin —
 * fixture data for the "an agent resolves a ticket" flow.
 *
 * The Customer's `displayName` deliberately does NOT embed `subject`
 * verbatim (it uses its own, separate random id instead): the ticket list
 * page renders both the ticket's subject and its customer's display name,
 * and `agent-resolves-ticket.spec.ts` locates the row with
 * `page.getByText(subject)` — if the customer name contained the subject
 * string too, that locator would match two elements (a Playwright "strict
 * mode violation", confirmed while first authoring this suite) instead of
 * the one table row it's meant to find. */
export async function createTicketAsAdmin(
  adminToken: string,
  subject: string,
): Promise<{ ticketId: string }> {
  const customer = await apiFetch<{ id: string }>("/customers", {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({ displayName: `Playwright fixture customer ${randomUUID()}` }),
  });
  const ticket = await apiFetch<{ id: string }>("/tickets", {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({ customerId: customer.id, subject }),
  });
  return { ticketId: ticket.id };
}

/** Creates a portal-enabled Contact (with its own dedicated Customer) as
 * the admin — fixture data for the "a customer submits a ticket through
 * the portal" flow. */
export async function createPortalContactAsAdmin(
  adminToken: string,
  email: string,
  password: string,
): Promise<void> {
  const customer = await apiFetch<{ id: string }>("/customers", {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({ displayName: `Playwright fixture customer ${email}` }),
  });
  const contact = await apiFetch<{ id: string }>(`/customers/${customer.id}/contacts`, {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({ fullName: "Playwright Fixture Contact", email }),
  });
  await apiFetch(`/customers/${customer.id}/contacts/${contact.id}/portal-password`, {
    method: "PATCH",
    token: adminToken,
    body: JSON.stringify({ newPassword: password }),
  });
}
