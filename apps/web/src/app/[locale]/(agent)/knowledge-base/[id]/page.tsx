import { ArticleDetailView } from "@/components/knowledge-base/article-detail-view";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArticleDetailView articleId={id} />;
}
