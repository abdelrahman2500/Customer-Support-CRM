import { BusinessHoursView } from "@/components/business-hours/business-hours-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "businessHours");

export default function BusinessHoursPage() {
  return <BusinessHoursView />;
}
