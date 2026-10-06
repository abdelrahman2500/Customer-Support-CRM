import { NotificationTemplatesView } from "@/components/notifications/notification-templates-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "notificationTemplates");

export default function NotificationTemplatesPage() {
  return <NotificationTemplatesView />;
}
