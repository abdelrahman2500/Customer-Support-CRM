import { CustomerDetailSkeleton } from "@/components/customers/customer-detail-view";

/**
 * Story 97 — Loading & Skeleton UX. Mirrors
 * `app/[locale]/(agent)/tickets/[id]/loading.tsx` exactly — see that
 * file's doc comment for the full rationale.
 */
export default function CustomerDetailLoading() {
  return <CustomerDetailSkeleton />;
}
