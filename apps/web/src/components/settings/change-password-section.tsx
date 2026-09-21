"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, FormField, Input } from "@crm/ui";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useChangePasswordMutation } from "@/hooks/use-change-password";
import { useErrorMessage } from "@/hooks/use-error-message";
import { clearAccessToken, logout } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";

/** The backend's own `@MinLength(8)` on `ChangeOwnPasswordDto.newPassword`.
 * Mirrored here only so an obvious mistake is caught before a round-trip —
 * the server remains the authority, and every other rule it enforces
 * (`IsPasswordComplex`) is deliberately NOT duplicated: a second, drifting
 * copy of a complexity regex in the client is worse than one extra
 * round-trip. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Story 147 — Self-Service Password Management.
 *
 * Until now the only way an agent's password could change was for an
 * administrator holding `user:reset-password` to set it for them
 * (`PATCH users/:id/password`). This is the self-service half:
 * `PATCH /auth/me/password`, authorised by the caller's own current
 * password rather than by any permission.
 *
 * A self-contained `Card` section appended to the "My sessions" page,
 * mirroring `NotificationPreferencesSection`'s own precedent (a settings
 * section that owns its own mutation and feedback, composed onto a page
 * whose primary view is something else). It sits beside the session list
 * deliberately: both are this app's personal account-security surface, and
 * the two are directly related — see the success copy below.
 *
 * ## Why this signs you out
 *
 * The backend revokes every refresh token for the user as part of the
 * change (`IdentityService.changeOwnPassword`), because `refresh()` never
 * re-checks the password hash — without that revocation, changing a
 * password because it may have leaked would leave every already-issued
 * session alive. That includes *this* session, so rather than let the user
 * discover it at a random moment when their access token next expires,
 * success replaces the form with an explicit prompt to sign in again.
 *
 * ## Confirmation field
 *
 * `confirmNewPassword` is a client-side typo guard only — it is never sent,
 * and the DTO has no field for it. The check is here, not on the server,
 * because it is a property of this form, not of the request.
 */
export function ChangePasswordSection() {
  const t = useTranslations("changePassword");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const mutation = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  // Only shown after a submit attempt, so the form doesn't scold the user
  // about a too-short password while they are still typing it.
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
      // Best-effort — mirrors `WorkspaceHeader.handleSignOut` exactly; the
      // local cleanup below always proceeds regardless.
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
      <Card className="p-surface">
        <h2 className="text-sm font-semibold text-ink">{t("heading")}</h2>
        <Alert variant="success" className="mt-2">
          {t("success")}
        </Alert>
        <Button type="button" className="mt-2" onClick={() => void handleSignOut()}>
          {t("signInAgain")}
        </Button>
      </Card>
    );
  }

  return (
    <Card asChild className="p-surface">
      <form onSubmit={handleSubmit} className="flex flex-col gap-stack">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("heading")}</h2>
          <p className="mt-1 text-xs text-ink-subtle">{t("description")}</p>
        </div>

        <FormField label={t("currentPassword")}>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </FormField>

        <FormField
          label={t("newPassword")}
          hint={t("newPasswordHint", { min: MIN_PASSWORD_LENGTH })}
          error={tooShort ? t("tooShort", { min: MIN_PASSWORD_LENGTH }) : undefined}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </FormField>

        <FormField
          label={t("confirmNewPassword")}
          error={mismatch ? t("mismatch") : undefined}
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
            {t("incomplete")}
          </p>
        )}

        {mutation.isError && (
          <Alert variant="destructive">
            {errorMessage(mutation.error, {
              forbidden: t("actionForbidden"),
              generic: t("actionFailed"),
            })}
          </Alert>
        )}

        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
