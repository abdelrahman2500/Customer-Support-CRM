import { ReportsView } from "@/components/reporting/reports-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "reports");

export default function ReportsPage() {
  return <ReportsView />;
}
