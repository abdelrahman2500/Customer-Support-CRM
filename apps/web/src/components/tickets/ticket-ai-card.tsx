"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSubmitAiOperationMutation, useTicketAiResultQuery } from "@/hooks/use-ticket-ai";
import type { TicketAiFeature } from "@/lib/ticket-ai-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, Button, LoadingStatus, SectionCard, Skeleton } from "@crm/ui";

const FEATURES: TicketAiFeature[] = [
  "SUMMARIZE",
  "SUGGEST_REPLY",
  "CATEGORIZE",
  "SUGGEST_SOLUTIONS",
];

const FEATURE_LABEL_KEYS: Record<TicketAiFeature, string> = {
  SUMMARIZE: "detail.aiSummarize",
  SUGGEST_REPLY: "detail.aiSuggestReply",
  CATEGORIZE: "detail.aiCategorize",
  SUGGEST_SOLUTIONS: "detail.aiSuggestSolutions",
};

/** Story 209 — a successful summary, as pinned at the top of the timeline. */
export interface PinnedSummary {
  id: string;
  text: string;
  at: string;
}

/**
 * Story 79 — the agent-facing AI card: four actions (Summarize / Suggest
 * Reply / Categorize / Suggest Solutions — the last added by RM-00), each
 * submitting via `POST /tickets/:id/ai/*` and
 * then tracking the returned `AiPromptLog.id` to poll the durable result
 * via `GET /tickets/:id/ai/:logId`. Only the most-recently-submitted
 * operation is shown at a time (mirrors this story's own non-goal of an
 * activity-feed UI) — clicking a different action replaces the tracked
 * result, but the earlier row is never lost from the database, only from
 * this card's own view.
 *
 * Kept live by `TicketDetailView`'s existing `useTicketRealtime`, whose
 * `ai.prompt_completed` handling invalidates this card's exact query key
 * once `apps/worker` resolves the operation — no second socket connection
 * is opened here (mirrors `TicketChatCard`'s own precedent).
 *
 * `DISABLED` (no `ANTHROPIC_API_KEY` configured) is rendered as a
 * distinct, non-error state — never the same path as `ERROR` — per this
 * story's own product rule: a caller must be able to tell "AI is off"
 * from "AI is broken" at a glance.
 *
 * Story 208 (RD-3.8, recon TW-06) — a suggested reply can be put into the
 * reply draft ("Insert into reply", via `onInsertReply`). It is only ever
 * inserted, never sent: the agent reviews and sends it from the composer.
 *
 * Story 209 (RD-3.9, recon TW-06) — a collapsible inspector section. A
 * polite live region, present from mount (a region inserted together with
 * its text is often not announced), says when the tracked operation is
 * working, ready, failed or turned off. A successful summary is handed to
 * `onSummary` so the conversation can pin it at the top of the timeline.
 */

export function TicketAiCard({
  ticketId,
  onApplyCategory,
  onInsertReply,
  onSummary,
}: {
  ticketId: string;
  onApplyCategory: (category: string) => void;
  onInsertReply?: (text: string) => void;
  onSummary?: (summary: PinnedSummary) => void;
}) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  // Global Navigation Loading (UX audit) — `submitMutation` is one shared
  // mutation object for all four buttons below, so `submitMutation.isPending`
  // alone can't say *which* of them was clicked; every button would show a
  // spinner at once, implying all four features are running. This tracks
  // just the clicked one, so `isLoading` lands on that single button while
  // `disabled` (from `submitMutation.isPending` alone, unchanged) still
  // blocks the other three from being clicked mid-submit.
  const [pendingFeature, setPendingFeature] = useState<TicketAiFeature | null>(null);
  const [operation, setOperation] = useState<{ feature: TicketAiFeature; logId: string } | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitMutation = useSubmitAiOperationMutation(ticketId);
  const resultQuery = useTicketAiResultQuery(ticketId, operation?.logId ?? null);
  const result = resultQuery.isSuccess ? resultQuery.data : undefined;

  // Story 209 — one hand-over per successful summary.
  useEffect(() => {
    if (
      operation?.feature === "SUMMARIZE" &&
      result?.outcome === "SUCCESS" &&
      result.outputText &&
      onSummary
    ) {
      onSummary({ id: result.id, text: result.outputText, at: result.createdAt });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per result id and outcome.
  }, [operation?.feature, result?.id, result?.outcome]);

  // Story 209 — what the live region says about the tracked operation.
  const featureLabel = operation ? t(FEATURE_LABEL_KEYS[operation.feature]) : "";
  const announcement = !operation
    ? ""
    : !result || result.outcome === "PENDING"
      ? t("detail.aiStatusPending", { feature: featureLabel })
      : result.outcome === "SUCCESS"
        ? t("detail.aiStatusReady", { feature: featureLabel })
        : result.outcome === "ERROR"
          ? t("detail.aiStatusFailed", { feature: featureLabel })
          : t("detail.aiStatusDisabled");

  async function submit(feature: TicketAiFeature): Promise<void> {
    setSubmitError(null);
    setPendingFeature(feature);
    try {
      const result = await submitMutation.mutateAsync(feature);
      setOperation({ feature, logId: result.id });
    } catch (error) {
      setSubmitError(
        errorMessage(error, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.aiSubmitFailed"),
        }),
      );
    } finally {
      setPendingFeature(null);
    }
  }

  return (
    <SectionCard title={t("detail.aiHeading")} collapsible>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {FEATURES.map((feature) => (
          <Button
            key={feature}
            type="button"
            variant="outline"
            size="sm"
            disabled={submitMutation.isPending}
            isLoading={pendingFeature === feature}
            onClick={() => void submit(feature)}
          >
            {t(FEATURE_LABEL_KEYS[feature])}
          </Button>
        ))}
      </div>

      {submitError && (
        <Alert variant="destructive" className="mt-2">
          {submitError}
        </Alert>
      )}

      {operation && (
        <div className="mt-3">
          {resultQuery.isLoading && (
            <LoadingStatus label={tCommon("loading")} asChild>
              <Skeleton className="h-16 w-full" />
            </LoadingStatus>
          )}

          {resultQuery.isSuccess && resultQuery.data.outcome === "PENDING" && (
            <p className="text-sm text-ink-subtle">{t("detail.aiPending")}</p>
          )}

          {resultQuery.isSuccess && resultQuery.data.outcome === "SUCCESS" && (
            <div className="flex flex-col gap-2">
              <p className="whitespace-pre-wrap text-sm text-ink-strong">
                {resultQuery.data.outputText}
              </p>
              {operation.feature === "CATEGORIZE" && resultQuery.data.outputText && (
                <div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onApplyCategory(resultQuery.data.outputText as string)}
                  >
                    {t("detail.aiUseAsCategory")}
                  </Button>
                </div>
              )}
              {operation.feature === "SUGGEST_REPLY" &&
                resultQuery.data.outputText &&
                onInsertReply && (
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onInsertReply(resultQuery.data.outputText as string)}
                    >
                      {t("detail.aiInsertIntoReply")}
                    </Button>
                  </div>
                )}
            </div>
          )}

          {resultQuery.isSuccess && resultQuery.data.outcome === "ERROR" && (
            <Alert variant="destructive">{resultQuery.data.errorMessage}</Alert>
          )}

          {/* Demo hardening — an environment without an AI provider says so
              plainly (a titled notice, not a bare sentence); nothing is
              invented in its place. */}
          {resultQuery.isSuccess && resultQuery.data.outcome === "DISABLED" && (
            <Alert variant="info" icon title={t("detail.aiDisabledTitle")}>
              {t("detail.aiDisabled")}
            </Alert>
          )}
        </div>
      )}
    </SectionCard>
  );
}
