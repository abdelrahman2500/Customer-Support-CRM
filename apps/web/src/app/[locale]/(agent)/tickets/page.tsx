import { TicketsView } from "@/components/tickets/tickets-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "tickets");

/** Story 216 (PR-3.1) — the board by default, the table as the List view. */
export default function TicketsPage() {
  return <TicketsView />;
}
