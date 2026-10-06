import { CreateArticleView } from "@/components/knowledge-base/create-article-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "knowledgeBase");

export default function NewArticlePage() {
  return <CreateArticleView />;
}
