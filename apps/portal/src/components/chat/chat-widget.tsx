"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useChatAiResultQuery,
  useChatMessagesQuery,
  useEscalateChatSessionMutation,
  useSendChatMessageMutation,
  useStartChatSessionMutation,
} from "@/hooks/use-chat";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { ApiError } from "@/lib/api";

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
        escalateSubmitError instanceof ApiError
          ? escalateSubmitError.message
          : t("escalateFailed"),
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
    <div className="rounded-md border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">{t("heading")}</h2>

      {startSession.isError && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("startFailed")}
        </p>
      )}

      {messagesQuery.isLoading && (
        <div className="mt-2 h-40 w-full animate-pulse rounded-md bg-slate-100" />
      )}
      {messagesQuery.isError && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("loadError")}
        </p>
      )}
      {messagesQuery.isSuccess && messagesQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">{t("empty")}</p>
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
                    isMine ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {message.body}
                </div>
                <span className="text-xs text-slate-500">
                  {isMine ? t("youLabel") : t("assistantLabel")}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "PENDING" && (
        <p className="mt-2 text-sm text-slate-500">{t("typing")}</p>
      )}
      {pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "ERROR" && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {resultQuery.data.errorMessage ?? t("replyFailed")}
        </p>
      )}
      {pendingLogId && resultQuery.isSuccess && resultQuery.data.outcome === "DISABLED" && (
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t("disabled")}
        </p>
      )}

      {messagesQuery.isSuccess && messagesQuery.data.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => void handleEscalate()}
            disabled={escalate.isPending}
            className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {escalate.isPending ? t("escalating") : t("escalate")}
          </button>
          {escalateError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {escalateError}
            </p>
          )}
        </div>
      )}

      <ChatComposer sessionId={sessionId} onSent={setPendingLogId} />
    </div>
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
      setError(submitError instanceof ApiError ? submitError.message : t("sendFailed"));
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
      <textarea
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        rows={2}
        value={body}
        placeholder={t("placeholder")}
        disabled={mutation.isPending || !sessionId}
        aria-label={t("placeholder")}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div>
        <button
          type="submit"
          disabled={mutation.isPending || !sessionId || !body.trim()}
          className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? t("sending") : t("send")}
        </button>
      </div>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
