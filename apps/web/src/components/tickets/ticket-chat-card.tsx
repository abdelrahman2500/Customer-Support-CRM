"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCreateTicketEmailMessageMutation,
  useCreateTicketMessageMutation,
  useEmailChannelStatusQuery,
  useTicketMessagesQuery,
} from "@/hooks/use-ticket-messages";
import {
  useCreateTicketNoteMutation,
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
  Checkbox,
  Label,
  LoadingStatus,
  SectionCard,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@crm/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crm/ui";
import {
  Avatar,
  Composer,
  HistoryEventIcon,
  InternalNoteIcon,
  Kbd,
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
 * reply. A filter (tabs) narrows the thread to one kind.
 *
 * Story 207 (RD-3.7) — one composer below it, in Reply or Internal note
 * mode (`TicketComposer`).
 */
export function TicketChatCard({ ticketId }: { ticketId: string }) {
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

      <TicketComposer ticketId={ticketId} />
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

type ComposerMode = "reply" | "note";
const COMPOSER_MODES: ComposerMode[] = ["reply", "note"];

/** Story 207 — where a mode's unsent draft lives for the session. */
function draftKey(ticketId: string, mode: ComposerMode): string {
  return `crm.ticketDraft.${ticketId}.${mode}`;
}

function readDraft(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, body: string): void {
  try {
    if (body) window.sessionStorage.setItem(key, body);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Storage blocked or full: the draft just isn't kept.
  }
}

/** Story 207 — one mode's body, mirrored to sessionStorage: restored after
 * mount (never during render, so server and client markup agree), written
 * on every change, and cleared with the field once a send succeeds. */
function useDraft(ticketId: string, mode: ComposerMode) {
  const key = draftKey(ticketId, mode);
  const [body, setBodyState] = useState("");

  useEffect(() => {
    const saved = readDraft(key);
    if (saved) setBodyState(saved);
  }, [key]);

  const setBody = useCallback(
    (next: string | ((current: string) => string)) => {
      setBodyState((current) => {
        const value = typeof next === "function" ? next(current) : next;
        writeDraft(key, value);
        return value;
      });
    },
    [key],
  );

  return [body, setBody] as const;
}

/**
 * Story 207 (RD-3.7, recon TW-04/A11Y-05/A11Y-09) — the ticket's one
 * composer, with a Reply mode and an Internal note mode. It replaces the
 * Live Chat composer below and the separate note form (`AddNoteForm`) that
 * used to sit under it; both modes keep their own payloads, copy and error
 * handling exactly.
 *
 * - The shell (`Composer`) sends on Enter but never mid-IME-composition,
 *   never disables the field, and returns focus to it after a send.
 * - Each mode has its own accessible name (not its placeholder); the mode
 *   tabs announce the switch, and the note mode is tinted and says who can
 *   see it.
 * - Each mode keeps its own draft, for the session, per ticket.
 *
 * Reply mode, from Story 78/91/RM-15 unchanged: Enter sends, Shift+Enter
 * inserts a newline; a rejected send renders inline and keeps the draft;
 * the quick-reply picker (omitted while loading or failed — it never blocks
 * the composer) inserts a reply's body into an empty draft or appends it
 * after a blank line; "Send by email" appears only once an `EMAIL` adapter
 * is configured and then switches the endpoint.
 *
 * Note mode, from Story 50/RM-06 unchanged: a basic `@mention` affordance —
 * only the trailing `@word...` run at the very end of the body is an active
 * mention trigger, and only when the `@` starts the note or follows
 * whitespace (the backend parser's own boundary rule in
 * `ticket-mentions.ts`). Picking a suggestion inserts the exact `fullName`
 * the backend's `parseMentions` matches against. The suggestions are now a
 * listbox driven from the keyboard (A11Y-05).
 */
function TicketComposer({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();
  const errorMessage = useErrorMessage();
  const [mode, setMode] = useState<ComposerMode>("reply");

  // Reply mode.
  const [replyBody, setReplyBody] = useDraft(ticketId, "reply");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState("");
  const [sendAsEmail, setSendAsEmail] = useState(false);
  const mutation = useCreateTicketMessageMutation(ticketId);
  const emailMutation = useCreateTicketEmailMessageMutation(ticketId);
  const emailStatusQuery = useEmailChannelStatusQuery();
  const quickRepliesQuery = useQuickRepliesQuery();
  const activeQuickReplies = (quickRepliesQuery.data ?? []).filter((reply) => reply.isActive);
  const activeMutation = sendAsEmail ? emailMutation : mutation;

  // Note mode.
  const [noteBody, setNoteBody] = useDraft(ticketId, "note");
  const [noteError, setNoteError] = useState<string | null>(null);
  const noteMutation = useCreateTicketNoteMutation(ticketId);
  const usersQuery = useUsersQuery();
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  async function sendReply(): Promise<void> {
    const trimmed = replyBody.trim();
    if (!trimmed || activeMutation.isPending) {
      return;
    }
    setReplyError(null);
    try {
      await activeMutation.mutateAsync({ body: trimmed });
      setReplyBody("");
    } catch (submitError) {
      setReplyError(
        errorMessage(submitError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.chatSendFailed"),
        }),
      );
    }
  }

  function insertQuickReply(quickReplyId: string): void {
    const quickReply = activeQuickReplies.find((reply) => reply.id === quickReplyId);
    setSelectedQuickReplyId("");
    if (!quickReply) {
      return;
    }
    setReplyBody((current) =>
      current.trim() ? `${current}\n\n${quickReply.body}` : quickReply.body,
    );
  }

  const mentionQuery = useMemo(() => {
    const lastAt = noteBody.lastIndexOf("@");
    if (lastAt === -1) {
      return null;
    }
    const charBefore = noteBody[lastAt - 1];
    if (charBefore !== undefined && !/\s/.test(charBefore)) {
      return null; // `@` mid-word — never a mention trigger.
    }
    const rest = noteBody.slice(lastAt + 1);
    return /\s/.test(rest) ? null : rest;
  }, [noteBody]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null || suggestionsDismissed) {
      return [];
    }
    const query = mentionQuery.toLowerCase();
    return (usersQuery.data ?? [])
      .filter((user) => user.fullName.toLowerCase().includes(query))
      .slice(0, 5);
  }, [mentionQuery, suggestionsDismissed, usersQuery.data]);

  function selectMention(fullName: string): void {
    const lastAt = noteBody.lastIndexOf("@");
    if (lastAt === -1) {
      return;
    }
    setNoteBody(`${noteBody.slice(0, lastAt)}@${fullName} `);
  }

  async function sendNote(): Promise<void> {
    setNoteError(null);
    try {
      await noteMutation.mutateAsync({ body: noteBody.trim() });
      setNoteBody("");
    } catch (submitError) {
      setNoteError(
        errorMessage(submitError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.notesCreateFailed"),
        }),
      );
    }
  }

  const hint = (
    <span className="hidden sm:inline">
      <Kbd>Enter</Kbd> {t("detail.composerHintSend")} · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd>{" "}
      {t("detail.composerHintNewline")}
    </span>
  );

  return (
    // Sticky at the bottom of the conversation card, so the composer stays
    // in reach while the agent reads a long timeline above it.
    <div className="sticky bottom-0 z-10 mt-3 border-t border-rule-subtle bg-surface pt-stack">
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as ComposerMode)}
        dir={localeDirection(locale)}
      >
        <TabsList aria-label={t("detail.composerModeLabel")}>
          {COMPOSER_MODES.map((value) => (
            <TabsTrigger key={value} value={value} className="inline-flex items-center gap-tight">
              {value === "note" && <InternalNoteIcon aria-hidden="true" className="size-3.5" />}
              {value === "reply" ? t("detail.composerModeReply") : t("detail.internalNoteLabel")}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="reply" className="pt-2">
          <Composer
            label={t("detail.composerReplyLabel")}
            placeholder={t("detail.chatPlaceholder")}
            rows={2}
            value={replyBody}
            onValueChange={setReplyBody}
            onSubmit={sendReply}
            canSubmit={!activeMutation.isPending && replyBody.trim().length > 0}
            pending={activeMutation.isPending}
            submitLabel={activeMutation.isPending ? t("detail.chatSending") : t("detail.chatSend")}
            hint={hint}
            toolbar={
              activeQuickReplies.length > 0 && (
                <Select value={selectedQuickReplyId} onValueChange={insertQuickReply}>
                  <SelectTrigger
                    className="w-full sm:w-64"
                    aria-label={t("detail.quickReplyPlaceholder")}
                  >
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
              )
            }
            footer={
              emailStatusQuery.data?.configured && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`send-as-email-${ticketId}`}
                    checked={sendAsEmail}
                    disabled={activeMutation.isPending}
                    onCheckedChange={(checked) => setSendAsEmail(checked === true)}
                  />
                  <Label htmlFor={`send-as-email-${ticketId}`}>
                    {t("detail.sendByEmailLabel")}
                  </Label>
                </div>
              )
            }
            error={replyError && <Alert variant="destructive">{replyError}</Alert>}
          />
        </TabsContent>

        <TabsContent value="note" className="pt-2">
          <p className="mb-2 flex items-center gap-tight text-caption text-warning-foreground">
            <InternalNoteIcon aria-hidden="true" className="size-3.5" />
            {t("detail.composerNoteHint")}
          </p>
          <Composer
            label={t("detail.composerNoteLabel")}
            placeholder={t("detail.notesPlaceholder")}
            tone="note"
            value={noteBody}
            onValueChange={(value) => {
              setSuggestionsDismissed(false);
              setNoteBody(value);
            }}
            onSubmit={sendNote}
            canSubmit={!noteMutation.isPending && noteBody.trim().length > 0}
            pending={noteMutation.isPending}
            submitLabel={
              noteMutation.isPending ? t("detail.notesSubmitting") : t("detail.notesSubmit")
            }
            hint={hint}
            suggestions={{
              label: t("detail.mentionSuggestions"),
              options: mentionMatches.map((user) => ({ id: user.id, label: user.fullName })),
              onPick: (id) => {
                const user = mentionMatches.find((match) => match.id === id);
                if (user) selectMention(user.fullName);
              },
              onDismiss: () => setSuggestionsDismissed(true),
            }}
            error={noteError && <Alert variant="destructive">{noteError}</Alert>}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
