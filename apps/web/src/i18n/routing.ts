import { defineRouting } from "next-intl/routing";

/**
 * The two locales required by the intake (Arabic + English). See
 * docs/architecture/10-i18n-and-rtl.md.
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
});
