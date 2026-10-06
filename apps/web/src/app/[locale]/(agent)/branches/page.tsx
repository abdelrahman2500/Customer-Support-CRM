import { BranchDepartmentsView } from "@/components/branches/branch-departments-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "branches");

export default function BranchesPage() {
  return <BranchDepartmentsView />;
}
