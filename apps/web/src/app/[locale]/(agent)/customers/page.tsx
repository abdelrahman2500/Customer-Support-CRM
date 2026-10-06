import { CustomerListView } from "@/components/customers/customer-list-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "customers");

export default function CustomersPage() {
  return <CustomerListView />;
}
