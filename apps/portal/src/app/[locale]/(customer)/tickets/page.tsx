import { TicketListView } from "@/components/tickets/ticket-list-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("tickets", "nav");

export default function TicketsPage() {
  return <TicketListView />;
}
