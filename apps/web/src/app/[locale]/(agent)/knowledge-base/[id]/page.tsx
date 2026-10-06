import { ArticleDetailView } from "@/components/knowledge-base/article-detail-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "knowledgeBase");

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArticleDetailView articleId={id} />;
}
