import { CreateUserView } from "@/components/users/create-user-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "users");

export default function CreateUserPage() {
  return <CreateUserView />;
}
