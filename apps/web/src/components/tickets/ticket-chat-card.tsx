"use client";

import { useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCreateTicketEmailMessageMutation,
  useCreateTicketMessageMutation,
  useEmailChannelStatusQuery,
  useTicketMessagesQuery,
} from "@/hooks/use-ticket-messages";
import {
  useCurrentUserQuery,
  useTicketEscalationsQuery,
  useTicketHistoryQuery,
  useTicketNotesQuery,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useQuickRepliesQuery } from "@/hooks/use-quick-replies";
import { useErrorMessage } from "@/hooks/use-error-message";
import { historyEventKey } from "@/lib/history-event";
import { localeDirection } from "@/i18n/direction";
import {
  Alert,
  Button,
  Checkbox,
  Label,
  LoadingStatus,
  SectionCard,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@crm/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";
import {
  Avatar,
  HistoryEventIcon,
  InternalNoteIcon,
  MessageBubble,
  MessageThread,
  WarningIcon,
  formatDate,
  formatDateTime,
  formatTime,
} from "@crm/ui";
import type { MessageThreadItem } from "@crm/ui";

/** Story 49 — `targetType` → its translation key, with the raw value as the
 * fallback for anything unrecognized. Moved here verbatim from
 * `TicketDetailView` with the escalations it labels (Story 206). */
const TARGET_TYPE_LABEL_KEYS: Record<string, string> = {
  response: "escalations.targetType.response",
  resolution: "escalations.targetType.resolution",
};

type TimelineKind = "message" | "note" | "history" | "escalation";
type TimelineFilter = "all" | "conversation" | "notes" | "events";

const TIMELINE_FILTERS: TimelineFilter[] = ["all", "conversation", "notes", "events"];
const FILTER_KINDS: Record<TimelineFilter, TimelineKind[]> = {
  all: ["message", "note", "history", "escalation"],
  conversation: ["message"],
  notes: ["note"],
  events: ["history", "escalation"],
};

type TimelineEntry = MessageThreadItem & { kind: TimelineKind };

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
 *
 * RM-13 — an `OUTBOUND` message whose `deliveryStatus` is anything other
 * than `DELIVERED` (the implicit state every Live Chat/Web Form/AI_CHAT
 * message has always been in) renders a small status label after its
 * timestamp. Invisible today — no adapter exists yet that ever produces
 * `PENDING`/`SENT`/`FAILED` — and stays live the same way the rest of this
 * card already does: a status transition re-emits `channel.message.created`
 * for the same message id, and `useTicketRealtime`'s handler now upserts
 * by id (RM-13's own `mergeChannelMessage` change) instead of ignoring a
 * repeat id, so this label updates in place with no extra wiring here.
 *
 * RM-15 — `ChatComposer` gains a "send by email" checkbox, visible only
 * once `useEmailChannelStatusQuery()` confirms an `EMAIL` adapter is
 * actually configured (`GET /channels/email-status`) — never offering an
 * action that would just leave a message `PENDING` forever. Checked,
 * `send()` calls `POST /tickets/:id/messages/email`
 * (`useCreateTicketEmailMessageMutation`) instead of the existing Live
 * Chat endpoint; every other part of the composer — the textarea, quick
 * replies, error handling — is shared unchanged between the two.
 *
 * Story 206 (RD-3.6, recon TW-04) — the card is the ticket's timeline:
 * messages, internal notes (Story 50), history events (Story 193 labels) and
 * SLA escalations (Story 49), in time order in one thread. They used to be
 * three more cards; their content, fallbacks and loading/error/empty
 * messages carry over unchanged. Notes have their own bordered warning
 * surface, a lock and the words "Internal note", so they never read as a
 * reply. A filter (tabs) narrows the thread to one kind. The note composer
 * is the caller's (`noteComposer`) until RD-3.7 merges the two composers.
 */
export function TicketChatCard({
  ticketId,
  noteComposer,
}: {
  ticketId: string;
  noteComposer?: ReactNode;
}) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();
  const messagesQuery = useTicketMessagesQuery(ticketId);
  const notesQuery = useTicketNotesQuery(ticketId);
  const historyQuery = useTicketHistoryQuery(ticketId);
  const escalationsQuery = useTicketEscalationsQuery(ticketId);
  const usersQuery = useUsersQuery();
  const currentUserQuery = useCurrentUserQuery();
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.fullName);
    }
    return map;
  }, [usersQuery.data]);

  // Story 205 (RD-3.5, recon TW-03) — scrolling now belongs to
  // MessageThread: it follows new messages only while the agent is at the
  // bottom, instead of yanking them down on every update.

  const entries: TimelineEntry[] = [];

  for (const message of messagesQuery.data ?? []) {
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

    entries.push({
      kind: "message",
      key: `message:${message.id}`,
      at: message.createdAt,
      node: (
        <MessageBubble
          align={isMine ? "end" : "start"}
          tone={isMine ? "mine" : "other"}
          sender={senderLabel}
          avatar={<Avatar name={senderLabel} size="sm" decorative />}
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
    });
  }

  for (const note of notesQuery.data ?? []) {
    // Story 50 — the author's name, or the raw id when it can't be resolved.
    const author = userNameById.get(note.authorUserId) ?? note.authorUserId;
    entries.push({
      kind: "note",
      key: `note:${note.id}`,
      at: note.createdAt,
      node: (
        <MessageBubble
          align={note.authorUserId === currentUserQuery.data?.id ? "end" : "start"}
          tone="note"
          label={
            <span className="inline-flex items-center gap-tight font-medium text-warning-foreground">
              <InternalNoteIcon aria-hidden="true" className="size-3" />
              {t("detail.internalNoteLabel")}
            </span>
          }
          sender={author}
          avatar={<Avatar name={author} size="sm" decorative />}
          at={note.createdAt}
          timeLabel={formatTime(note.createdAt, locale)}
          dateTimeLabel={formatDateTime(note.createdAt, locale)}
        >
          {note.body}
        </MessageBubble>
      ),
    });
  }

  for (const entry of historyQuery.data ?? []) {
    entries.push({
      kind: "history",
      key: `history:${entry.id}`,
      at: entry.createdAt,
      node: (
        <TimelineEvent
          icon={<HistoryEventIcon aria-hidden="true" className="size-3.5" />}
          label={t(`detail.historyEvent.${historyEventKey(entry.eventType)}`)}
          // Only a name the loaded users resolve; a system event (no actor)
          // or an unknown id shows none rather than a raw id.
          actor={entry.actorUserId ? userNameById.get(entry.actorUserId) : undefined}
          at={entry.createdAt}
          locale={locale}
        />
      ),
    });
  }

  for (const escalation of escalationsQuery.data ?? []) {
    const targetTypeLabelKey = TARGET_TYPE_LABEL_KEYS[escalation.targetType];
    entries.push({
      kind: "escalation",
      key: `escalation:${escalation.id}`,
      at: escalation.escalatedAt,
      node: (
        <TimelineEvent
          icon={<WarningIcon aria-hidden="true" className="size-3.5 text-warning-foreground" />}
          label={t("detail.timelineEscalated")}
          detail={targetTypeLabelKey ? t(targetTypeLabelKey) : escalation.targetType}
          at={escalation.escalatedAt}
          locale={locale}
        />
      ),
    });
  }

  // `sort` is stable: entries at the same instant keep their source order.
  entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const loading =
    messagesQuery.isLoading ||
    notesQuery.isLoading ||
    historyQuery.isLoading ||
    escalationsQuery.isLoading;

  const errors: { kind: TimelineKind; message: string }[] = [];
  if (messagesQuery.isError) errors.push({ kind: "message", message: t("detail.chatLoadError") });
  if (notesQuery.isError) errors.push({ kind: "note", message: t("detail.notesError") });
  if (historyQuery.isError) errors.push({ kind: "history", message: t("detail.historyError") });
  if (escalationsQuery.isError) {
    errors.push({ kind: "escalation", message: t("detail.escalationsError") });
  }

  const isEmpty = (query: { isSuccess: boolean; data?: unknown[] }) =>
    query.isSuccess && query.data?.length === 0;

  function emptyMessages(tab: TimelineFilter, shown: number): string[] {
    switch (tab) {
      case "all":
        return shown === 0 && errors.length === 0 ? [t("detail.chatEmpty")] : [];
      case "conversation":
        return isEmpty(messagesQuery) ? [t("detail.chatEmpty")] : [];
      case "notes":
        return isEmpty(notesQuery) ? [t("detail.notesEmpty")] : [];
      case "events":
        return [
          ...(isEmpty(historyQuery) ? [t("detail.historyEmpty")] : []),
          ...(isEmpty(escalationsQuery) ? [t("detail.escalationsEmpty")] : []),
        ];
    }
  }

  return (
    <SectionCard title={t("detail.chatHeading")}>
      {/* `dir`: Radix reads direction from its prop, not the document, so the
          arrow keys follow the reading direction only when told (Story 206). */}
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as TimelineFilter)}
        dir={localeDirection(locale)}
      >
        <TabsList aria-label={t("detail.timelineFilterLabel")} className="mt-2">
          {TIMELINE_FILTERS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`detail.timelineFilter.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {TIMELINE_FILTERS.map((tab) => {
          const kinds = FILTER_KINDS[tab];
          const shown = entries.filter((entry) => kinds.includes(entry.kind));
          return (
            <TabsContent key={tab} value={tab} className="pt-2">
              {loading ? (
                <LoadingStatus label={tCommon("loading")} asChild>
                  <Skeleton className="mt-2 h-40 w-full" />
                </LoadingStatus>
              ) : (
                <>
                  {errors
                    .filter((error) => kinds.includes(error.kind))
                    .map((error) => (
                      <Alert key={error.kind} variant="destructive" className="mt-2">
                        {error.message}
                      </Alert>
                    ))}
                  {shown.length > 0 && (
                    // Story 205 (RD-3.5, recon TW-03) — a labelled log (new
                    // entries are announced), grouped by day with a date per
                    // day.
                    <MessageThread
                      label={t("detail.chatHeading")}
                      newMessagesLabel={t("detail.chatNewMessages")}
                      formatDay={(at) => formatDate(at, locale)}
                      className="mt-2"
                      items={shown}
                    />
                  )}
                  {emptyMessages(tab, shown.length).map((message) => (
                    <p key={message} className="mt-2 text-sm text-ink-subtle">
                      {message}
                    </p>
                  ))}
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <ChatComposer ticketId={ticketId} />

      {noteComposer && (
        // Story 206 — until RD-3.7 merges the composers, the note composer
        // is captioned the same way a note is marked in the thread.
        <div className="mt-section border-t border-rule-subtle pt-stack">
          <p className="flex items-center gap-tight text-caption font-medium text-warning-foreground">
            <InternalNoteIcon aria-hidden="true" className="size-3.5" />
            {t("detail.internalNoteLabel")}
          </p>
          {noteComposer}
        </div>
      )}
    </SectionCard>
  );
}

/** Story 206 — a history event or an SLA escalation in the timeline: one
 * centred caption line, so events read as context between the messages. The
 * time is shown; the full date and time is its `title`. */
function TimelineEvent({
  icon,
  label,
  detail,
  actor,
  at,
  locale,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  actor?: string;
  at: string;
  locale: string;
}) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-tight text-center text-caption text-ink-subtle">
      {icon}
      <span className="font-medium text-ink">{label}</span>
      {detail && <span>{detail}</span>}
      {actor && (
        <>
          <span aria-hidden="true">·</span>
          <span>{actor}</span>
        </>
      )}
      <span aria-hidden="true">·</span>
      <time dateTime={at} title={formatDateTime(at, locale)}>
        {formatTime(at, locale)}
      </time>
    </p>
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
  const errorMessage = useErrorMessage();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState("");
  const [sendAsEmail, setSendAsEmail] = useState(false);
  const mutation = useCreateTicketMessageMutation(ticketId);
  const emailMutation = useCreateTicketEmailMessageMutation(ticketId);
  const emailStatusQuery = useEmailChannelStatusQuery();
  const quickRepliesQuery = useQuickRepliesQuery();
  const activeQuickReplies = (quickRepliesQuery.data ?? []).filter((reply) => reply.isActive);
  const activeMutation = sendAsEmail ? emailMutation : mutation;

  async function send(): Promise<void> {
    const trimmed = body.trim();
    if (!trimmed || activeMutation.isPending) {
      return;
    }
    setError(null);
    try {
      await activeMutation.mutateAsync({ body: trimmed });
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
          <SelectTrigger className="w-full sm:w-64" aria-label={t("detail.quickReplyPlaceholder")}>
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
      <Textarea
        rows={2}
        value={body}
        placeholder={t("detail.chatPlaceholder")}
        disabled={activeMutation.isPending}
        aria-label={t("detail.chatPlaceholder")}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {emailStatusQuery.data?.configured && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`send-as-email-${ticketId}`}
            checked={sendAsEmail}
            disabled={activeMutation.isPending}
            onCheckedChange={(checked) => setSendAsEmail(checked === true)}
          />
          <Label htmlFor={`send-as-email-${ticketId}`}>{t("detail.sendByEmailLabel")}</Label>
        </div>
      )}
      <div>
        <Button type="submit" size="sm" disabled={activeMutation.isPending || !body.trim()}>
          {activeMutation.isPending ? t("detail.chatSending") : t("detail.chatSend")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}
