import { NotificationHistoryView } from "@/components/notifications/notification-history-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "notifications");

export default function NotificationsPage() {
  return <NotificationHistoryView />;
}
