import { WebhookSubscriptionsView } from "@/components/webhook-subscriptions/webhook-subscriptions-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "webhookSubscriptions");

export default function WebhookSubscriptionsPage() {
  return <WebhookSubscriptionsView />;
}
