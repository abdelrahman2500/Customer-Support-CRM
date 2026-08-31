"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSubmitAiOperationMutation, useTicketAiResultQuery } from "@/hooks/use-ticket-ai";
import type { TicketAiFeature } from "@/lib/ticket-ai-api";
import { ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const FEATURES: TicketAiFeature[] = ["SUMMARIZE", "SUGGEST_REPLY", "CATEGORIZE"];

const FEATURE_LABEL_KEYS: Record<TicketAiFeature, string> = {
  SUMMARIZE: "detail.aiSummarize",
  SUGGEST_REPLY: "detail.aiSuggestReply",
  CATEGORIZE: "detail.aiCategorize",
};

/**
 * Story 79 — the agent-facing AI card: three actions (Summarize / Suggest
 * Reply / Categorize), each submitting via `POST /tickets/:id/ai/*` and
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
 */
export function TicketAiCard({
  ticketId,
  onApplyCategory,
}: {
  ticketId: string;
  onApplyCategory: (category: string) => void;
}) {
  const t = useTranslations("tickets");
  const [operation, setOperation] = useState<{ feature: TicketAiFeature; logId: string } | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitMutation = useSubmitAiOperationMutation(ticketId);
  const resultQuery = useTicketAiResultQuery(ticketId, operation?.logId ?? null);

  async function submit(feature: TicketAiFeature): Promise<void> {
    setSubmitError(null);
    try {
      const result = await submitMutation.mutateAsync(feature);
      setOperation({ feature, logId: result.id });
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : t("detail.aiSubmitFailed"));
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.aiHeading")}</h2>

      <div className="mt-2 flex flex-wrap gap-2">
        {FEATURES.map((feature) => (
          <Button
            key={feature}
            type="button"
            variant="outline"
            size="sm"
            disabled={submitMutation.isPending}
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
          {resultQuery.isLoading && <Skeleton className="h-16 w-full" />}

          {resultQuery.isSuccess && resultQuery.data.outcome === "PENDING" && (
            <p className="text-sm text-slate-500">{t("detail.aiPending")}</p>
          )}

          {resultQuery.isSuccess && resultQuery.data.outcome === "SUCCESS" && (
            <div className="flex flex-col gap-2">
              <p className="whitespace-pre-wrap text-sm text-slate-700">
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
            </div>
          )}

          {resultQuery.isSuccess && resultQuery.data.outcome === "ERROR" && (
            <Alert variant="destructive">{resultQuery.data.errorMessage}</Alert>
          )}

          {resultQuery.isSuccess && resultQuery.data.outcome === "DISABLED" && (
            <Alert>{t("detail.aiDisabled")}</Alert>
          )}
        </div>
      )}
    </div>
  );
}
