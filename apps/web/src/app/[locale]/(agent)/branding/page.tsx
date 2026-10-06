import { BrandingView } from "@/components/admin/branding-view";
import { pageTitle } from "@/lib/page-title";

export const generateMetadata = pageTitle("workspace.nav", "branding");

export default function BrandingPage() {
  return <BrandingView />;
}
