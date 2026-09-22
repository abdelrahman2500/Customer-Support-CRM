"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, FormField, Input, SectionCard } from "@crm/ui";
import { useChangePasswordMutation } from "@/hooks/use-change-password";
import { useErrorMessage } from "@/hooks/use-error-message";
import { clearAccessToken, logout } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";

/** The backend's own `@MinLength(8)` on `ChangePortalPasswordDto`; see
 * `apps/web`'s `ChangePasswordSection` for why only the length rule — and
 * not the complexity regex — is mirrored client-side. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Story 147 — Self-Service Password Management, portal side.
 *
 * Until now, a customer who wanted a new portal password had to ask an
 * agent to set one for them through
 * `PATCH /customers/:id/contacts/:contactId/portal-password`. That route
 * is unchanged and remains the answer for a customer who is locked out;
 * this simply stops it being the only way in.
 *
 * Mirrors `apps/web`'s `ChangePasswordSection` field-for-field, including
 * its sign-out-on-success behaviour and the reason for it (the backend
 * revokes every `ContactRefreshToken` as part of the change, because
 * `PortalService.refresh` never re-checks the password hash).
 */
export function ChangePasswordSection() {
  const t = useTranslations("account");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const mutation = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmNewPassword.length > 0 && confirmNewPassword !== newPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmNewPassword === newPassword;

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // Best-effort — mirrors `PortalHeader.handleSignOut` exactly.
    }
    clearAccessToken();
    clearQueryCache();
    router.push(`/${locale}/login`);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit) {
      return;
    }
    mutation.mutate({ currentPassword, newPassword });
  }

  if (mutation.isSuccess) {
    return (
      <SectionCard title={t("changePassword.heading")}>
        <Alert variant="success" className="mt-2">
          {t("changePassword.success")}
        </Alert>
        <Button type="button" className="mt-2" onClick={() => void handleSignOut()}>
          {t("changePassword.signInAgain")}
        </Button>
      </SectionCard>
    );
  }

  return (
    <Card asChild className="p-surface">
      <form onSubmit={handleSubmit} className="flex flex-col gap-stack">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("changePassword.heading")}</h2>
          <p className="mt-1 text-xs text-ink-subtle">{t("changePassword.description")}</p>
        </div>

        <FormField label={t("changePassword.currentPassword")}>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </FormField>

        <FormField
          label={t("changePassword.newPassword")}
          hint={t("changePassword.newPasswordHint", { min: MIN_PASSWORD_LENGTH })}
          error={tooShort ? t("changePassword.tooShort", { min: MIN_PASSWORD_LENGTH }) : undefined}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </FormField>

        <FormField
          label={t("changePassword.confirmNewPassword")}
          error={mismatch ? t("changePassword.mismatch") : undefined}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
          />
        </FormField>

        {submitted && !canSubmit && (
          <p role="status" className="text-xs text-danger-foreground">
            {t("changePassword.incomplete")}
          </p>
        )}

        {mutation.isError && (
          <Alert variant="destructive">
            {errorMessage(mutation.error, {
              forbidden: t("changePassword.actionForbidden"),
              generic: t("changePassword.actionFailed"),
            })}
          </Alert>
        )}

        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("changePassword.submitting") : t("changePassword.submit")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
