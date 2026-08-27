import { TicketDetailView } from "@/components/tickets/ticket-detail-view";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketDetailView ticketId={id} />;
}
