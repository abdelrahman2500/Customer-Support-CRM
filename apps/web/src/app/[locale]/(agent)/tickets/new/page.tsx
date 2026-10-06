import { CreateTicketView } from "@/components/tickets/create-ticket-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "tickets");

export default function NewTicketPage() {
  return <CreateTicketView />;
}
