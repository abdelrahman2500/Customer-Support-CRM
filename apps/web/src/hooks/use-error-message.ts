import { useTranslations } from "next-intl";
import { resolveErrorMessage } from "@/lib/error-message";

/**
 * Story 94 — thin convenience wrapper around `resolveErrorMessage` so a
 * call site only ever supplies its own two feature-scoped strings
 * (`forbidden`/`generic`) — the two new shared `common.errors.*` strings
 * are resolved here, once, rather than re-fetched via `useTranslations("common")`
 * at every one of the ~15 call sites this story touches.
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
