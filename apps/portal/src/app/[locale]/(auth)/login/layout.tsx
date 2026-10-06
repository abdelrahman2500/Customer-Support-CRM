import type { ReactNode } from "react";
import { pageTitle } from "@/lib/page-title";

/**
 * Story 232 (PR-6.1) — the login page is a client component, which cannot
 * export metadata, so its title lives on this pass-through layout.
 */
export const generateMetadata = pageTitle("auth", "title");

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
