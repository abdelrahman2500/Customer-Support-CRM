import { MySessionsView } from "@/components/settings/my-sessions-view";
import { ChangePasswordSection } from "@/components/settings/change-password-section";

/** Story 147 — the second component on this page. `/my-sessions` is the
 * `account` nav group's personal account-security screen, and a password
 * change belongs with the session list rather than on a route of its own:
 * changing the password revokes every session shown above it. Mirrors
 * `NotificationHistoryView`'s own "primary view plus a self-contained
 * settings section" composition. */
export default function MySessionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <MySessionsView />
      <ChangePasswordSection />
    </div>
  );
}
