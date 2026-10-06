import { SettingsView } from "@/components/settings/settings-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "settings");

export default function SettingsPage() {
  return <SettingsView />;
}
