import { AccountView } from "@/components/settings/account-view";

/** Story 147 — the second component on this page. `/my-sessions` is the
 * `account` nav group's personal account-security screen, and a password
 * change belongs with the session list rather than on a route of its own:
 * changing the password revokes every session shown above it. Mirrors
 * `NotificationHistoryView`'s own "primary view plus a self-contained
 * settings section" composition. */
export default function MySessionsPage() {
  // Story 224 (PR-4.3) — profile facts, sessions and password in one Account area.
  return <AccountView />;
}
