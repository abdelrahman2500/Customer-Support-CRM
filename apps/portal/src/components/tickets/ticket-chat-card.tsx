"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useMyTicketMessagesQuery,
  useSendMyTicketMessageMutation,
} from "@/hooks/use-portal-tickets";
import { useErrorMessage } from "@/hooks/use-error-message";

/**
 * Story 78 — Live Chat UI (Customer Portal side). Reads
 * `GET /portal/tickets/:id/messages` and sends via
 * `POST /portal/tickets/:id/messages` (both Story 77, unchanged); kept live
 * by `TicketDetailView`'s `usePortalTicketRealtime`, whose
 * `channel.message.created` handling already merges new messages into this
 * card's own query cache — no second socket connection is opened here.
 *
 * Unlike the agent side, no sender-name resolution is needed: exactly one
 * Contact can ever message a given ticket (Story 53's ownership scoping), so
 * every `INBOUND` message is always "this contact's own" and every
 * `OUTBOUND` one is always "an agent's" — a Portal contact has no access to
 * the agent user list (`identity` module is agent-only), so agents are
 * labeled generically rather than by name.
 */
export function TicketChatCard({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();
  const messagesQuery = useMyTicketMessagesQuery(ticketId);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messagesQuery.data]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.chatHeading")}</h2>

      {messagesQuery.isLoading && (
        <div className="mt-2 h-40 w-full animate-pulse rounded-md bg-slate-100" />
      )}
      {messagesQuery.isError && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("detail.chatLoadError")}
        </div>
      )}
      {messagesQuery.isSuccess && messagesQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">{t("detail.chatEmpty")}</p>
      )}
      {messagesQuery.isSuccess && messagesQuery.data.length > 0 && (
        <ol
          ref={listRef}
          aria-label={t("detail.chatHeading")}
          className="mt-2 flex max-h-80 flex-col gap-3 overflow-y-auto py-1"
        >
          {messagesQuery.data.map((message) => {
            const isMine = message.direction === "INBOUND";
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
                  {isMine ? t("detail.chatYouLabel") : t("detail.chatAgentLabel")} ·{" "}
                  {new Date(message.createdAt).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <ChatComposer ticketId={ticketId} />
    </div>
  );
}

/** Enter sends, Shift+Enter inserts a newline — mirrors `apps/web`'s own
 * `ChatComposer` exactly. Never assumes a send succeeds: a rejected mutation
 * renders inline and leaves the draft in the textarea. */
function ChatComposer({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useSendMyTicketMessageMutation(ticketId);

  async function send(): Promise<void> {
    const trimmed = body.trim();
    if (!trimmed || mutation.isPending) {
      return;
    }
    setError(null);
    try {
      await mutation.mutateAsync({ body: trimmed });
      setBody("");
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.chatSendFailed"),
        }),
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
      <textarea
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        rows={2}
        value={body}
        placeholder={t("detail.chatPlaceholder")}
        disabled={mutation.isPending}
        aria-label={t("detail.chatPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div>
        <button
          type="submit"
          disabled={mutation.isPending || !body.trim()}
          className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? t("detail.chatSending") : t("detail.chatSend")}
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
