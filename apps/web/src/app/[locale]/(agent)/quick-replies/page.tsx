import { QuickRepliesView } from "@/components/quick-replies/quick-replies-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "quickReplies");

export default function QuickRepliesPage() {
  return <QuickRepliesView />;
}
