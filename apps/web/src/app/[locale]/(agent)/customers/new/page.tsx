import { CreateCustomerView } from "@/components/customers/create-customer-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "customers");

export default function NewCustomerPage() {
  return <CreateCustomerView />;
}
