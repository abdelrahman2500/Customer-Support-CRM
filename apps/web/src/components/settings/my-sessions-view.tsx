"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMySessionsQuery, useRevokeSessionMutation } from "@/hooks/use-sessions";
import type { SessionSummary } from "@/lib/sessions-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Story 124 — Session/Device Management. Lists the caller's own active
 * sessions (one per logged-in device/browser — see the backend's
 * `SessionSummary` doc comment) with a "Sign out" action per non-current
 * row, mirroring `AiSettingsView`'s loading/error/empty shape and
 * `UserRow`'s per-row `ConfirmDialog` convention for an irreversible,
 * immediate-effect security action.
 */
export function MySessionsView() {
  const t = useTranslations("mySessions");
  const sessionsQuery = useMySessionsQuery();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
      <p className="text-sm text-slate-500">{t("description")}</p>

      {sessionsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
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
        <p className="text-sm text-slate-500">{t("empty")}</p>
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
  const errorMessage = useErrorMessage();
  const mutation = useRevokeSessionMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{session.userAgent ?? t("unknownDevice")}</span>
          {session.isCurrent && <Badge variant="secondary">{t("thisDevice")}</Badge>}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-slate-500">
        {session.ipAddress ?? "—"}
      </TableCell>
      <TableCell>{new Date(session.lastActiveAt).toLocaleString()}</TableCell>
      <TableCell>{new Date(session.sessionCreatedAt).toLocaleString()}</TableCell>
      <TableCell>
        {!session.isCurrent && (
          <>
            <Button
              type="button"
              variant="destructive"
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
          <p className="text-xs text-red-600">
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
