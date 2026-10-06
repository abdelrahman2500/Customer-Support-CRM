import { NotificationHistoryView } from "@/components/portal/notification-history-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("notifications", "nav");

export default function NotificationsPage() {
  return <NotificationHistoryView />;
}
