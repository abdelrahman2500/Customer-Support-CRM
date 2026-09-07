"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useApiKeysQuery, useCreateApiKeyMutation, useRevokeApiKeyMutation } from "@/hooks/use-api-keys";
import { API_KEY_SCOPES } from "@/lib/api-keys-api";
import type { ApiKeySummary } from "@/lib/api-keys-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

/** "active" | "revoked" | "expired" — computed client-side from
 * `revokedAt`/`expiresAt`, mirroring how `WebhookDeliveryAttemptSummary`'s
 * own result badge is derived rather than stored redundantly. */
function apiKeyStatus(apiKey: ApiKeySummary): "active" | "revoked" | "expired" {
  if (apiKey.revokedAt) {
    return "revoked";
  }
  if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

/**
 * RM-22 — API-Key Authentication for Machine-to-Machine Consumers. Mirrors
 * `WebhookSubscriptionsView`'s exact "table + inline create-form below it,
 * no separate route" single-page shape and its one-time-secret-reveal
 * convention (RM-20) — the raw key is shown once, in an `Alert` right
 * below the form, the instant `createApiKey` succeeds, and never again.
 */
export function ApiKeysView() {
  const t = useTranslations("apiKeys");
  const apiKeysQuery = useApiKeysQuery();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      {apiKeysQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {apiKeysQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => apiKeysQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {apiKeysQuery.isSuccess && apiKeysQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
          {t("empty")}
        </p>
      )}

      {apiKeysQuery.isSuccess && apiKeysQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.label")}</TableHead>
              <TableHead>{t("columns.keyPrefix")}</TableHead>
              <TableHead>{t("columns.scopes")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.lastUsedAt")}</TableHead>
              <TableHead>{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeysQuery.data.map((apiKey) => (
              <ApiKeyRow key={apiKey.id} apiKey={apiKey} />
            ))}
          </TableBody>
        </Table>
      )}

      <AddApiKeyForm />
    </section>
  );
}

/** One existing key's own row — a dedicated component so
 * `useRevokeApiKeyMutation` is called once per row, mirroring
 * `SubscriptionRows`' Rules-of-Hooks convention. */
function ApiKeyRow({ apiKey }: { apiKey: ApiKeySummary }) {
  const t = useTranslations("apiKeys");
  const errorMessage = useErrorMessage();
  const mutation = useRevokeApiKeyMutation();
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);
  const status = apiKeyStatus(apiKey);

  function confirmRevoke() {
    mutation.mutate(apiKey.id, { onSuccess: () => setConfirmRevokeOpen(false) });
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-slate-800">{apiKey.label}</TableCell>
      <TableCell className="font-mono text-xs text-slate-500">{apiKey.keyPrefix}…</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {apiKey.scopes.map((scope) => (
            <Badge key={scope} variant="secondary">
              {scope}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={status === "active" ? "success" : status === "expired" ? "secondary" : "destructive"}>
          {t(`status.${status}`)}
        </Badge>
      </TableCell>
      <TableCell className="text-slate-500">
        {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : t("neverUsed")}
      </TableCell>
      <TableCell>
        <Button
          variant="destructive"
          size="sm"
          disabled={status === "revoked" || mutation.isPending}
          onClick={() => setConfirmRevokeOpen(true)}
        >
          {t("revoke")}
        </Button>
        <ConfirmDialog
          open={confirmRevokeOpen}
          onOpenChange={setConfirmRevokeOpen}
          title={t("revokeConfirmTitle")}
          description={t("revokeConfirmDescription", { label: apiKey.label })}
          confirmLabel={t("revoke")}
          onConfirm={confirmRevoke}
          isPending={mutation.isPending}
        />
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {errorMessage(mutation.error, { forbidden: t("actionForbidden"), generic: t("actionFailed") })}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}

/** The smallest UI surface for a create form — an inline form below the
 * table, mirroring `AddWebhookSubscriptionForm`'s exact submit/error/
 * one-time-reveal pattern. */
function AddApiKeyForm() {
  const t = useTranslations("apiKeys");
  const errorMessage = useErrorMessage();
  const [label, setLabel] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const mutation = useCreateApiKeyMutation();

  function toggleScope(scope: string, checked: boolean) {
    setSelectedScopes((current) => (checked ? [...current, scope] : current.filter((value) => value !== scope)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setRevealedKey(null);
    try {
      const created = await mutation.mutateAsync({ label: label.trim(), scopes: selectedScopes });
      setRevealedKey(created.rawKey);
      setLabel("");
      setSelectedScopes([]);
    } catch (submitError) {
      setError(errorMessage(submitError, { forbidden: t("actionForbidden"), generic: t("createFailed") }));
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("createHeading")}</h2>
      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("labelLabel")}
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("labelPlaceholder")}
            required
            minLength={1}
            className="w-full max-w-md"
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs text-slate-600">{t("scopesLabel")}</legend>
          <div className="flex flex-wrap gap-3">
            {API_KEY_SCOPES.map((scope) => (
              <div key={scope} className="flex items-center gap-2">
                <Checkbox
                  id={`api-key-scope-${scope}`}
                  checked={selectedScopes.includes(scope)}
                  onCheckedChange={(checked) => toggleScope(scope, checked === true)}
                />
                <Label htmlFor={`api-key-scope-${scope}`} className="text-xs font-normal">
                  {scope}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
        <div>
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !label.trim() || selectedScopes.length === 0}
          >
            {mutation.isPending ? t("createSubmitting") : t("createSubmit")}
          </Button>
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        {revealedKey && (
          <Alert>
            <p className="font-medium">{t("keyRevealedTitle")}</p>
            <p className="mt-1 text-xs">{t("keyRevealedDescription")}</p>
            <code className="mt-2 block break-all rounded bg-slate-100 p-2 text-xs">{revealedKey}</code>
          </Alert>
        )}
      </form>
    </div>
  );
}
