import { ArticleDetailSkeleton } from "@/components/knowledge-base/article-detail-view";

/**
 * Story 97 — Loading & Skeleton UX. Mirrors
 * `app/[locale]/(customer)/tickets/[id]/loading.tsx` exactly — see that
 * file's doc comment for the full rationale.
 *
 * Batch 2 (UX audit) — this route segment was the one `[id]` detail page
 * that never got a `loading.tsx` when Story 97 introduced the pattern for
 * its sibling.
 */
export default function ArticleDetailLoading() {
  return <ArticleDetailSkeleton />;
}
