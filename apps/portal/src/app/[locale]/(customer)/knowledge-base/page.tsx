import { ArticleListView } from "@/components/knowledge-base/article-list-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("knowledgeBase", "nav");

export default function KnowledgeBasePage() {
  return <ArticleListView />;
}
