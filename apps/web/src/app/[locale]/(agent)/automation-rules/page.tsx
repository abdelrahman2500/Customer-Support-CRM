import { AutomationRulesView } from "@/components/automation-rules/automation-rules-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "automationRules");

export default function AutomationRulesPage() {
  return <AutomationRulesView />;
}
