import { UserListView } from "@/components/users/user-list-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "users");

export default function UsersPage() {
  return <UserListView />;
}
