import { CreateSlaPolicyView } from "@/components/sla-policies/create-sla-policy-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "slaPolicies");

export default function NewSlaPolicyPage() {
  return <CreateSlaPolicyView />;
}
