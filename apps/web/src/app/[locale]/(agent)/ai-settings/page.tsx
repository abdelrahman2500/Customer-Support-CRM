import { AiSettingsView } from "@/components/admin/ai-settings-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "aiSettings");

export default function AiSettingsPage() {
  return <AiSettingsView />;
}
