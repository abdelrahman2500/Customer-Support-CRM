import { TicketDetailView } from "@/components/tickets/ticket-detail-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("tickets", "nav");

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketDetailView ticketId={id} />;
}
