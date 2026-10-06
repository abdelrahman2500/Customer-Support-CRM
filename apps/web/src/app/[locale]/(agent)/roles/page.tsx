import { RoleListView } from "@/components/roles/role-list-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "roles");

export default function RolesPage() {
  return <RoleListView />;
}
