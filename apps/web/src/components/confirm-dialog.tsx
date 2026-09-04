"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog as UiConfirmDialog } from "@crm/ui";

type UiProps = ComponentProps<typeof UiConfirmDialog>;

/**
 * Story S-2 — this app's localization binding for `@crm/ui`'s
 * `ConfirmDialog`. Not a second implementation of the primitive: the dialog
 * itself (focus capture/restore, pending lock, Escape/overlay suppression,
 * destructive styling) lives once in the shared package. This file supplies
 * the two strings the package deliberately refuses to own.
 *
 * Why the package refuses them: `@crm/ui` has no dependency on `next-intl`
 * and no knowledge of either app's message namespaces, so every
 * user-visible string reaches it as an already-translated prop — the
 * convention this codebase already documented for translated text crossing
 * a component boundary. `title`, `description` and `confirmLabel` were
 * always passed that way by callers; `cancelLabel` and `workingLabel` came
 * from an internal `useTranslations("common")` and now arrive the same way.
 *
 * Why here and not at each call site: those two strings are the *same* two
 * strings for all 15 call sites. Threading them through every one would
 * duplicate `common.cancel`/`common.working` a dozen times and force a
 * `useTranslations("common")` scope into twelve components that do not
 * otherwise need one. Binding them once, at the app's own boundary, keeps
 * the shared primitive i18n-agnostic and the call sites unchanged.
 *
 * `cancelLabel` stays optional here — matching the pre-S-2 public API of
 * this exact module — so a caller can still override it.
 */
export function ConfirmDialog(
  props: Omit<UiProps, "cancelLabel" | "workingLabel"> & { cancelLabel?: string },
) {
  const t = useTranslations("common");
  return (
    <UiConfirmDialog
      {...props}
      cancelLabel={props.cancelLabel ?? t("cancel")}
      workingLabel={t("working")}
    />
  );
}
