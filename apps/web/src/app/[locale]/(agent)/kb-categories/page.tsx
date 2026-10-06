import { KbCategoriesView } from "@/components/kb-categories/kb-categories-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "kbCategories");

export default function KbCategoriesPage() {
  return <KbCategoriesView />;
}
