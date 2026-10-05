"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useTranslations } from "next-intl";
import {
  useChatAiResultQuery,
  useChatMessagesQuery,
  useEscalateChatSessionMutation,
  useSendChatMessageMutation,
  useStartChatSessionMutation,
} from "@/hooks/use-chat";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  AiSummaryIcon,
  Alert,
  Avatar,
  Button,
  Card,
  Composer,
  ConfirmDialog,
  LoadingStatus,
  MessageBubble,
  MessageThread,
  PageHeader,
  Skeleton,
  formatDate,
  formatDateTime,
  formatTime,
} from "@crm/ui";

/**
 * Story 80 — AI Portal Chatbot (Foundation). Crosses
 * `apps/web/src/components/tickets/ticket-ai-card.tsx`'s
 * PENDING/SUCCESS/ERROR/DISABLED conventions with the portal ticket
 * conversation's message-list-plus-composer layout.
 *
 * A fresh chat session is started on mount (component-local state only,
 * no persistence beyond the mounted page) — an explicit, acceptable
 * Foundation-phase simplification (see this story's own plan). The
 * message list (`useChatMessagesQuery`) is the single source of truth
 * for conversation history — a successful reply is read from there, not
 * rendered directly from the result-polling query, which exists only to
 * drive the "thinking"/error/disabled states for the single
 * most-recently-sent turn.
 *
 * Story 231 (PR-5.3) — the page gets its h1 (it had none) and becomes a
 * full-height conversation on the shared `MessageThread` (`fill`),
 * `MessageBubble` and `Composer`. "Thinking…" is announced through a
 * polite `role="status"` line that stays mounted, and escalating to a
 * person — which creates a ticket — asks for confirmation first.
 */
export function ChatWidget() {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [confirmEscalate, setConfirmEscalate] = useState(false);
  const startSession = useStartChatSessionMutation();
  const messagesQuery = useChatMessagesQuery(sessionId);
  const resultQuery = useChatAiResultQuery(sessionId, pendingLogId);
  const escalate = useEscalateChatSessionMutation(sessionId ?? "");
  useChatRealtime(sessionId);

  async function handleEscalate(): Promise<void> {
    if (!sessionId || escalate.isPending) {
      return;
    }
    setEscalateError(null);
    try {
      const result = await escalate.mutateAsync();
      setConfirmEscalate(false);
      router.push(`/${locale}/tickets/${result.ticketId}`);
    } catch (escalateSubmitError) {
      setConfirmEscalate(false);
      setEscalateError(
        errorMessage(escalateSubmitError, {
          forbidden: t("actionForbidden"),
          generic: t("escalateFailed"),
        }),
      );
    }
  }

  useEffect(() => {
    if (sessionId || startSession.isPending) {
      return;
    }
    startSession.mutate(undefined, {
      onSuccess: (session) => setSessionId(session.id),
    });
    // Runs once on mount; `startSession` is a stable mutation object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once a pending turn resolves (no longer PENDING), it has either
  // become a real ChatMessage (SUCCESS, now in messagesQuery.data) or
  // failed (ERROR/DISABLED, rendered inline below) — either way there is
  // nothing left to poll for.
  useEffect(() => {
    if (resultQuery.isSuccess && resultQuery.data.outcome !== "PENDING") {
      setPendingLogId(null);
    }
  }, [resultQuery.isSuccess, resultQuery.data?.outcome]);

  const messages = messagesQuery.data ?? [];
  const thinking = Boolean(
    pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "PENDING",
  );
  const items = messages.map((message) => {
    const isMine = message.role === "CUSTOMER";
    const sender = isMine ? t("youLabel") : t("assistantLabel");
    return {
      key: message.id,
      at: message.createdAt,
      node: (
        <MessageBubble
          align={isMine ? "end" : "start"}
          tone={isMine ? "mine" : "other"}
          sender={sender}
          avatar={
            isMine ? (
              <Avatar name={sender} size="sm" decorative />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full bg-accent-surface text-accent"
              >
                <AiSummaryIcon className="size-4" />
              </span>
            )
          }
          at={message.createdAt}
          timeLabel={formatTime(message.createdAt, locale)}
          dateTimeLabel={formatDateTime(message.createdAt, locale)}
        >
          {message.body}
        </MessageBubble>
      ),
    };
  });

  return (
    <section className="flex h-[calc(100dvh-11rem)] min-h-[28rem] flex-col gap-section">
      <PageHeader
        title={t("heading")}
        description={t("description")}
        actions={
          messagesQuery.isSuccess && messages.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmEscalate(true)}
              disabled={escalate.isPending}
            >
              {escalate.isPending ? t("escalating") : t("escalate")}
            </Button>
          ) : undefined
        }
      />

      {escalateError && <Alert variant="destructive">{escalateError}</Alert>}

      <ConfirmDialog
        open={confirmEscalate}
        onOpenChange={setConfirmEscalate}
        title={t("escalateConfirmTitle")}
        description={t("escalateConfirmBody")}
        confirmLabel={t("escalateConfirm")}
        cancelLabel={t("escalateCancel")}
        workingLabel={t("escalating")}
        onConfirm={() => void handleEscalate()}
        isPending={escalate.isPending}
      />

      <Card className="flex min-h-0 flex-1 flex-col p-surface">
        {startSession.isError && <Alert variant="destructive">{t("startFailed")}</Alert>}

        {messagesQuery.isLoading && (
          <LoadingStatus label={tCommon("loading")} asChild>
            <Skeleton className="h-40 w-full" />
          </LoadingStatus>
        )}
        {messagesQuery.isError && <Alert variant="destructive">{t("loadError")}</Alert>}
        {messagesQuery.isSuccess && messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full bg-accent-surface text-accent"
            >
              <AiSummaryIcon className="size-5" />
            </span>
            <p className="text-sm text-ink-subtle">{t("empty")}</p>
          </div>
        )}
        {items.length > 0 && (
          <MessageThread
            fill
            label={t("heading")}
            items={items}
            formatDay={(at) => formatDate(at, locale)}
            newMessagesLabel={t("newMessages")}
          />
        )}

        {/* Always mounted, so the change to "Thinking…" is announced. */}
        <p role="status" className="mt-2 text-sm text-ink-subtle empty:hidden">
          {thinking ? t("typing") : ""}
        </p>
        {pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "ERROR" && (
          <Alert variant="destructive" className="mt-2">
            {resultQuery.data.errorMessage ?? t("replyFailed")}
          </Alert>
        )}
        {pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "DISABLED" && (
          <Alert className="mt-2">{t("disabled")}</Alert>
        )}

        <ChatComposer sessionId={sessionId} onSent={setPendingLogId} />
      </Card>
    </section>
  );
}

/** Never assumes a send succeeds; sending waits for a session. */
function ChatComposer({
  sessionId,
  onSent,
}: {
  sessionId: string | null;
  onSent: (logId: string) => void;
}) {
  const t = useTranslations("chat");
  const errorMessage = useErrorMessage();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useSendChatMessageMutation(sessionId ?? "");

  async function send(): Promise<void> {
    const trimmed = body.trim();
    if (!trimmed || mutation.isPending || !sessionId) {
      return;
    }
    setError(null);
    try {
      const result = await mutation.mutateAsync(trimmed);
      setBody("");
      onSent(result.id);
    } catch (submitError) {
      setError(
        errorMessage(submitError, { forbidden: t("actionForbidden"), generic: t("sendFailed") }),
      );
    }
  }

  return (
    <Composer
      className="mt-3"
      label={t("composerLabel")}
      placeholder={t("placeholder")}
      rows={2}
      value={body}
      onValueChange={setBody}
      onSubmit={send}
      canSubmit={Boolean(sessionId) && !mutation.isPending && body.trim().length > 0}
      pending={mutation.isPending}
      submitLabel={mutation.isPending ? t("sending") : t("send")}
      hint={t("hint")}
      error={error && <Alert variant="destructive">{error}</Alert>}
    />
  );
}
