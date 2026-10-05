"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useMyTicketMessagesQuery,
  useSendMyTicketMessageMutation,
} from "@/hooks/use-portal-tickets";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Avatar,
  Composer,
  LoadingStatus,
  MessageBubble,
  MessageThread,
  SectionCard,
  Skeleton,
  formatDate,
  formatDateTime,
  formatTime,
} from "@crm/ui";

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
 * RM-13 — an `OUTBOUND` (agent's) message whose `deliveryStatus` isn't
 * `DELIVERED` renders a small status label after its timestamp.
 *
 * Story 230 (PR-5.2) — the agent workspace's own conversation parts: the
 * shared `MessageThread` (a polite `role="log"` grouped by day, which only
 * follows new messages while the reader is at the bottom), `MessageBubble`
 * and `Composer` (Enter sends, Shift+Enter adds a line, IME-safe, the field
 * stays focusable while sending). The card is called "Conversation", the
 * same word the agent uses for the same messages.
 */
export function TicketChatCard({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();
  const messagesQuery = useMyTicketMessagesQuery(ticketId);

  const items = (messagesQuery.data ?? []).map((message) => {
    const isMine = message.direction === "INBOUND";
    const sender = isMine ? t("detail.chatYouLabel") : t("detail.chatAgentLabel");
    return {
      key: message.id,
      at: message.createdAt,
      node: (
        <MessageBubble
          align={isMine ? "end" : "start"}
          tone={isMine ? "mine" : "other"}
          sender={sender}
          avatar={<Avatar name={sender} size="sm" decorative />}
          at={message.createdAt}
          timeLabel={formatTime(message.createdAt, locale)}
          dateTimeLabel={formatDateTime(message.createdAt, locale)}
          status={
            message.direction === "OUTBOUND" && message.deliveryStatus !== "DELIVERED" ? (
              <span
                className={
                  message.deliveryStatus === "FAILED" ? "text-danger-foreground" : undefined
                }
              >
                {t(`detail.chatDeliveryStatus.${message.deliveryStatus}`)}
              </span>
            ) : undefined
          }
        >
          {message.body}
        </MessageBubble>
      ),
    };
  });

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
      {messagesQuery.isSuccess && items.length === 0 && (
        <p className="mt-2 text-sm text-ink-subtle">{t("detail.chatEmpty")}</p>
      )}
      {items.length > 0 && (
        <MessageThread
          className="mt-2"
          label={t("detail.chatHeading")}
          items={items}
          formatDay={(at) => formatDate(at, locale)}
          newMessagesLabel={t("detail.chatNewMessages")}
        />
      )}

      <ChatComposer ticketId={ticketId} />
    </SectionCard>
  );
}

/** Never assumes a send succeeds: a rejected mutation renders inline and
 * leaves the draft in the field. */
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

  return (
    <Composer
      className="mt-3"
      label={t("detail.chatComposerLabel")}
      placeholder={t("detail.chatPlaceholder")}
      rows={2}
      value={body}
      onValueChange={setBody}
      onSubmit={send}
      canSubmit={!mutation.isPending && body.trim().length > 0}
      pending={mutation.isPending}
      submitLabel={mutation.isPending ? t("detail.chatSending") : t("detail.chatSend")}
      hint={t("detail.chatHint")}
      error={error && <Alert variant="destructive">{error}</Alert>}
    />
  );
}
