"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMySessionsQuery, useRevokeSessionMutation } from "@/hooks/use-sessions";
import type { SessionSummary } from "@/lib/sessions-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, Badge, Button, LoadingStatus, PageHeader, Skeleton } from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@crm/ui";
import { formatDateTime } from "@crm/ui";

/**
 * Story 224 — a readable device name ("Chrome · Windows") from a user agent;
 * the full string stays in the title. Unrecognised agents show as they are.
 */
function describeUserAgent(userAgent: string): string {
  const browser = (
    [
      [/Edg\//, "Edge"],
      [/OPR\//, "Opera"],
      [/Firefox\//, "Firefox"],
      [/Chrome\//, "Chrome"],
      [/Version\/.*Safari\//, "Safari"],
    ] as const
  ).find(([pattern]) => pattern.test(userAgent))?.[1];
  const os = (
    [
      [/Windows/, "Windows"],
      [/Android/, "Android"],
      [/iPhone|iPad/, "iOS"],
      [/Mac OS X/, "macOS"],
      [/Linux/, "Linux"],
    ] as const
  ).find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && os) return `${browser} · ${os}`;
  return browser ?? os ?? userAgent;
}

/**
 * Story 124 — Session/Device Management. Lists the caller's own active
 * sessions (one per logged-in device/browser — see the backend's
 * `SessionSummary` doc comment) with a "Sign out" action per non-current
 * row, mirroring `AiSettingsView`'s loading/error/empty shape and
 * `UserRow`'s per-row `ConfirmDialog` convention for an irreversible,
 * immediate-effect security action.
 *
 * Story 224 — `hosted`: a section of the Account page (an h2 under its h1).
 */
export function MySessionsView({ hosted = false }: { hosted?: boolean } = {}) {
  const t = useTranslations("mySessions");
  const tCommon = useTranslations("common");
  const sessionsQuery = useMySessionsQuery();

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} headingLevel={hosted ? 2 : 1} />

      {sessionsQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </LoadingStatus>
      )}

      {sessionsQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => sessionsQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {sessionsQuery.isSuccess && sessionsQuery.data.length === 0 && (
        <p className="text-sm text-ink-subtle">{t("empty")}</p>
      )}

      {sessionsQuery.isSuccess && sessionsQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.device")}</TableHead>
              <TableHead>{t("columns.ipAddress")}</TableHead>
              <TableHead>{t("columns.lastActive")}</TableHead>
              <TableHead>{t("columns.signedInSince")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessionsQuery.data.map((session) => (
              <SessionRow key={session.sessionId} session={session} />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  const t = useTranslations("mySessions");
  // Same locale-aware date convention every other table in this app uses
  // (e.g. `audit-log-view.tsx`) — an omitted `locale` argument silently
  // formats in the browser's own locale, not the one the user picked.
  const { locale } = useParams<{ locale: string }>();
  const errorMessage = useErrorMessage();
  const mutation = useRevokeSessionMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <TableRow>
      {/* Story 150 — below `sm` these two dates stacked as bare,
          indistinguishable lines; the labels reuse each column's own
          header key. The trailing actions cell takes none. */}
      <TableCell label={t("columns.device")}>
        <div className="flex items-center gap-2">
          <span title={session.userAgent ?? undefined} className="min-w-0 break-words">
            {session.userAgent ? describeUserAgent(session.userAgent) : t("unknownDevice")}
          </span>
          {session.isCurrent && <Badge variant="secondary">{t("thisDevice")}</Badge>}
        </div>
      </TableCell>
      <TableCell label={t("columns.ipAddress")} className="font-mono text-xs text-ink-subtle">
        {session.ipAddress ?? "—"}
      </TableCell>
      <TableCell label={t("columns.lastActive")}>
        {formatDateTime(session.lastActiveAt, locale)}
      </TableCell>
      <TableCell label={t("columns.signedInSince")}>
        {formatDateTime(session.sessionCreatedAt, locale)}
      </TableCell>
      <TableCell>
        {!session.isCurrent && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {t("signOut")}
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={t("signOutConfirmTitle")}
              description={t("signOutConfirmDescription")}
              confirmLabel={t("signOut")}
              isPending={mutation.isPending}
              onConfirm={() => mutation.mutate(session.sessionId)}
            />
          </>
        )}
        {mutation.isError && (
          <p className="text-xs text-danger-foreground">
            {errorMessage(mutation.error, {
              forbidden: t("actionForbidden"),
              generic: t("actionFailed"),
            })}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
