"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
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
import { Alert, Button, LoadingStatus, SectionCard, Skeleton, Textarea } from "@crm/ui";

/**
 * Story 80 — AI Portal Chatbot (Foundation). Crosses
 * `apps/web/src/components/tickets/ticket-ai-card.tsx`'s
 * PENDING/SUCCESS/ERROR/DISABLED conventions with
 * `apps/portal/src/components/tickets/ticket-chat-card.tsx`'s
 * message-list-plus-composer layout.
 *
 * A fresh chat session is started on mount (component-local state only,
 * no persistence beyond the mounted page) — an explicit, acceptable
 * Foundation-phase simplification (see this story's own plan). The
 * message list (`useChatMessagesQuery`) is the single source of truth
 * for conversation history — a successful reply is read from there, not
 * rendered directly from the result-polling query, which exists only to
 * drive the "typing…"/error/disabled states for the single
 * most-recently-sent turn.
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
  const startSession = useStartChatSessionMutation();
  const messagesQuery = useChatMessagesQuery(sessionId);
  const resultQuery = useChatAiResultQuery(sessionId, pendingLogId);
  const escalate = useEscalateChatSessionMutation(sessionId ?? "");
  useChatRealtime(sessionId);
  const listRef = useRef<HTMLOListElement>(null);

  async function handleEscalate(): Promise<void> {
    if (!sessionId || escalate.isPending) {
      return;
    }
    setEscalateError(null);
    try {
      const result = await escalate.mutateAsync();
      router.push(`/${locale}/tickets/${result.ticketId}`);
    } catch (escalateSubmitError) {
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

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messagesQuery.data]);

  // Once a pending turn resolves (no longer PENDING), it has either
  // become a real ChatMessage (SUCCESS, now in messagesQuery.data) or
  // failed (ERROR/DISABLED, rendered inline below) — either way there is
  // nothing left to poll for.
  useEffect(() => {
    if (resultQuery.isSuccess && resultQuery.data.outcome !== "PENDING") {
      setPendingLogId(null);
    }
  }, [resultQuery.isSuccess, resultQuery.data?.outcome]);

  return (
    <SectionCard title={t("heading")}>
      {startSession.isError && (
        <Alert variant="destructive" className="mt-2">
          {t("startFailed")}
        </Alert>
      )}

      {messagesQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} asChild>
          <Skeleton className="mt-2 h-40 w-full" />
        </LoadingStatus>
      )}
      {messagesQuery.isError && (
        <Alert variant="destructive" className="mt-2">
          {t("loadError")}
        </Alert>
      )}
      {messagesQuery.isSuccess && messagesQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-ink-subtle">{t("empty")}</p>
      )}
      {messagesQuery.isSuccess && messagesQuery.data.length > 0 && (
        <ol
          ref={listRef}
          aria-label={t("heading")}
          className="mt-2 flex max-h-80 flex-col gap-3 overflow-y-auto py-1"
        >
          {messagesQuery.data.map((message) => {
            const isMine = message.role === "CUSTOMER";
            return (
              <li
                key={message.id}
                className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
                    isMine ? "bg-accent text-accent-foreground" : "bg-surface-muted text-ink-strong"
                  }`}
                >
                  {message.body}
                </div>
                <span className="text-xs text-ink-subtle">
                  {isMine ? t("youLabel") : t("assistantLabel")}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "PENDING" && (
        <p className="mt-2 text-sm text-ink-subtle">{t("typing")}</p>
      )}
      {pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "ERROR" && (
        <Alert variant="destructive" className="mt-2">
          {resultQuery.data.errorMessage ?? t("replyFailed")}
        </Alert>
      )}
      {pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "DISABLED" && (
        <p className="mt-2 rounded-md border border-rule bg-surface-sunk px-3 py-2 text-sm text-ink-muted">
          {t("disabled")}
        </p>
      )}

      {messagesQuery.isSuccess && messagesQuery.data.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-rule pt-3">
          <Button
            type="button"
            onClick={() => void handleEscalate()}
            disabled={escalate.isPending}
            variant="outline"
            className="w-fit"
          >
            {escalate.isPending ? t("escalating") : t("escalate")}
          </Button>
          {escalateError && <Alert variant="destructive">{escalateError}</Alert>}
        </div>
      )}

      <ChatComposer sessionId={sessionId} onSent={setPendingLogId} />
    </SectionCard>
  );
}

/** Enter sends, Shift+Enter inserts a newline — mirrors
 * `TicketChatCard`'s own composer exactly. Disabled until a session
 * exists; never assumes a send succeeds. */
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

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <form className="mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
      <Textarea
        rows={2}
        value={body}
        placeholder={t("placeholder")}
        disabled={mutation.isPending || !sessionId}
        aria-label={t("placeholder")}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div>
        <Button
          type="submit"
          disabled={mutation.isPending || !sessionId || !body.trim()}
          className="w-fit"
        >
          {mutation.isPending ? t("sending") : t("send")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}
