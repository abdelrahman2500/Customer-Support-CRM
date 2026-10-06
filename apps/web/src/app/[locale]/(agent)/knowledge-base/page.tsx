import { ArticleListView } from "@/components/knowledge-base/article-list-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "knowledgeBase");

export default function KnowledgeBasePage() {
  return <ArticleListView />;
}
