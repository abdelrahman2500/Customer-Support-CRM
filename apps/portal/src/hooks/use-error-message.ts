import { useTranslations } from "next-intl";
import { resolveErrorMessage } from "@/lib/error-message";

/**
 * Story 94 — portal counterpart of `apps/web/src/hooks/use-error-message.ts`.
 */
export function useErrorMessage() {
  const t = useTranslations("common");
  return (error: unknown, copy: { forbidden: string; generic: string }): string =>
    resolveErrorMessage(error, {
      forbidden: copy.forbidden,
      generic: copy.generic,
      network: t("errors.network"),
      unauthorized: t("errors.unauthorized"),
    });
}
