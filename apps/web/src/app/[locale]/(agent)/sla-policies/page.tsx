import { SlaPolicyListView } from "@/components/sla-policies/sla-policy-list-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "slaPolicies");

export default function SlaPoliciesPage() {
  return <SlaPolicyListView />;
}
