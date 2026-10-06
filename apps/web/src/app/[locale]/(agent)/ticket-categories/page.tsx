import { TicketCategoriesView } from "@/components/ticket-categories/ticket-categories-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "ticketCategories");

export default function TicketCategoriesPage() {
  return <TicketCategoriesView />;
}
