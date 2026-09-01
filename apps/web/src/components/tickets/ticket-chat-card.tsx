"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateTicketMessageMutation, useTicketMessagesQuery } from "@/hooks/use-ticket-messages";
import { useCurrentUserQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useQuickRepliesQuery } from "@/hooks/use-quick-replies";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Story 78 — Live Chat UI (agent side). Reads `GET /tickets/:id/messages`
 * and sends via `POST /tickets/:id/messages` (both Story 77, unchanged);
 * kept live by `TicketDetailView`'s existing `useTicketRealtime`, whose
 * `channel.message.created` handling already merges new messages into this
 * card's own query cache — no second socket connection is opened here.
 *
 * "My own message" vs. a colleague's `OUTBOUND` one is resolved via
 * `useCurrentUserQuery()`: unlike the ticket's customer (exactly one Contact
 * can ever message a given ticket, Story 53's ownership scoping), several
 * different agents can send `OUTBOUND` messages on the same ticket, so
 * `direction` alone isn't enough to mean "mine."
 */
export function TicketChatCard({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();
  const messagesQuery = useTicketMessagesQuery(ticketId);
  const usersQuery = useUsersQuery();
  const currentUserQuery = useCurrentUserQuery();
  const listRef = useRef<HTMLOListElement>(null);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.fullName);
    }
    return map;
  }, [usersQuery.data]);

  // Keep the conversation scrolled to the latest message as history loads
  // and as new messages arrive (initial load, sends, and realtime merges all
  // flow through the same `messagesQuery.data` array).
  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messagesQuery.data]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.chatHeading")}</h2>

      {messagesQuery.isLoading && <Skeleton className="mt-2 h-40 w-full" />}
      {messagesQuery.isError && (
        <Alert variant="destructive" className="mt-2">
          {t("detail.chatLoadError")}
        </Alert>
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
            const isMine =
              message.direction === "OUTBOUND" && message.senderUserId === currentUserQuery.data?.id;
            // Story 85 — an AI_CHAT-channel OUTBOUND message replayed from a
            // chat escalation has no senderUserId at all (the AI wrote it,
            // not a signed-in agent) — without this branch it would
            // misleadingly fall through to the generic "Agent" label below.
            const isAiAssistantMessage =
              message.channelType === "AI_CHAT" &&
              message.direction === "OUTBOUND" &&
              !message.senderUserId;
            const senderLabel =
              message.direction === "INBOUND"
                ? t("detail.chatCustomerLabel")
                : isAiAssistantMessage
                  ? t("detail.chatAiLabel")
                  : isMine
                    ? t("detail.chatYouLabel")
                    : (message.senderUserId && userNameById.get(message.senderUserId)) ||
                      t("detail.chatAgentLabel");

            return (
              <li
                key={message.id}
                className={cn("flex flex-col gap-1", isMine ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap",
                    isMine ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800",
                  )}
                >
                  {message.body}
                </div>
                <span className="text-xs text-slate-500">
                  {senderLabel} ·{" "}
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

/** Enter sends, Shift+Enter inserts a newline — the composer never assumes
 * a send succeeds (Design item 5's rule, unchanged): a rejected mutation
 * renders inline and leaves the draft in the textarea so nothing typed is
 * lost.
 *
 * Story 91 — gains a quick-reply picker above the textarea. Reads
 * `useQuickRepliesQuery()` directly (no prop drilling, mirrors every other
 * hook this component already calls); while the query is loading or has
 * failed, the picker is simply omitted — it never blocks the composer's
 * core send/receive flow (mirrors `BranchNotifications`/`PortalNotifications`'s
 * own "never break the primary flow" resilience rule). Selecting a reply
 * inserts its body into the draft — replaces it when empty, else appends
 * with a blank-line separator so nothing already typed is discarded. */
function ChatComposer({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState("");
  const mutation = useCreateTicketMessageMutation(ticketId);
  const quickRepliesQuery = useQuickRepliesQuery();
  const activeQuickReplies = (quickRepliesQuery.data ?? []).filter((reply) => reply.isActive);

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
      setError(submitError instanceof ApiError ? submitError.message : t("detail.chatSendFailed"));
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

  function insertQuickReply(quickReplyId: string): void {
    const quickReply = activeQuickReplies.find((reply) => reply.id === quickReplyId);
    setSelectedQuickReplyId("");
    if (!quickReply) {
      return;
    }
    setBody((current) => (current.trim() ? `${current}\n\n${quickReply.body}` : quickReply.body));
  }

  return (
    <form className="mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
      {activeQuickReplies.length > 0 && (
        <Select value={selectedQuickReplyId} onValueChange={insertQuickReply}>
          <SelectTrigger className="w-64" aria-label={t("detail.quickReplyPlaceholder")}>
            <SelectValue placeholder={t("detail.quickReplyPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {activeQuickReplies.map((reply) => (
              <SelectItem key={reply.id} value={reply.id}>
                {reply.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <textarea
        className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        rows={2}
        value={body}
        placeholder={t("detail.chatPlaceholder")}
        disabled={mutation.isPending}
        aria-label={t("detail.chatPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div>
        <Button type="submit" size="sm" disabled={mutation.isPending || !body.trim()}>
          {mutation.isPending ? t("detail.chatSending") : t("detail.chatSend")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}
