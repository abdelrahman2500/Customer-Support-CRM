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
import { Alert, Button, LoadingStatus, SectionCard, Skeleton, Textarea } from "@crm/ui";

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
 *
 * RM-13 — mirrors `apps/web`'s own identical delivery-status indicator:
 * an `OUTBOUND` (agent's) message whose `deliveryStatus` isn't `DELIVERED`
 * renders a small status label after its timestamp. Invisible today (no
 * adapter exists yet), and stays live via the same `mergeChannelMessage`
 * upsert-by-id change — see that file's own doc comment.
 */
export function TicketChatCard({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
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
    <SectionCard title={t("detail.chatHeading")}>
      {messagesQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} asChild>
          <Skeleton className="mt-2 h-40 w-full" />
        </LoadingStatus>
      )}
      {messagesQuery.isError && (
        <Alert variant="destructive" className="mt-2">
          {t("detail.chatLoadError")}
        </Alert>
      )}
      {messagesQuery.isSuccess && messagesQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-ink-subtle">{t("detail.chatEmpty")}</p>
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
                    isMine ? "bg-accent text-accent-foreground" : "bg-surface-muted text-ink-strong"
                  }`}
                >
                  {message.body}
                </div>
                <span className="text-xs text-ink-subtle">
                  {isMine ? t("detail.chatYouLabel") : t("detail.chatAgentLabel")} ·{" "}
                  {new Date(message.createdAt).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {message.direction === "OUTBOUND" && message.deliveryStatus !== "DELIVERED" && (
                    <>
                      {" · "}
                      <span
                        className={message.deliveryStatus === "FAILED" ? "text-red-700" : undefined}
                      >
                        {t(`detail.chatDeliveryStatus.${message.deliveryStatus}`)}
                      </span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <ChatComposer ticketId={ticketId} />
    </SectionCard>
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
      <Textarea
        rows={2}
        value={body}
        placeholder={t("detail.chatPlaceholder")}
        disabled={mutation.isPending}
        aria-label={t("detail.chatPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div>
        <Button type="submit" disabled={mutation.isPending || !body.trim()} className="w-fit">
          {mutation.isPending ? t("detail.chatSending") : t("detail.chatSend")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}
