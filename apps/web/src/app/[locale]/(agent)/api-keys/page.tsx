import { ApiKeysView } from "@/components/api-keys/api-keys-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "apiKeys");

export default function ApiKeysPage() {
  return <ApiKeysView />;
}
