import { ApiError } from "./api";

/**
 * Story 94 — portal counterpart of `apps/web/src/lib/error-message.ts`
 * (same classification rule, independently re-declared per this
 * codebase's own "no shared package between `apps/web`/`apps/portal`"
 * convention — see e.g. `notifications-api.ts`'s own `NotificationSummary`
 * re-declaration precedent). Fixes the identical Recon finding on the
 * portal side: `ticket-list-view.tsx`, `ticket-detail-view.tsx` (CSAT),
 * `ticket-chat-card.tsx`, `chat-widget.tsx`, and
 * `notification-preferences-section.tsx` all did
 * `error instanceof ApiError ? error.message : t("...Failed")`, showing
 * raw backend text for any non-network `ApiError` including an unexpected
 * 500 — not just the 400/409 cases where that text is genuinely useful,
 * deliberate, user-facing validation feedback.
 */
export type ErrorPresentation =
  | { kind: "forbidden" }
  | { kind: "unauthorized" }
  | { kind: "network" }
  | { kind: "validation"; message: string }
  | { kind: "generic" };

export function classifyError(error: unknown): ErrorPresentation {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return { kind: "forbidden" };
    }
    if (error.status === 401) {
      return { kind: "unauthorized" };
    }
    // Every other 4xx (400 validation, 404 not-found, 409 conflict, 422
    // unprocessable, ...) is a deliberate NestJS exception with a real,
    // curated message meant for the caller to read. A 5xx is an unexpected
    // server-side failure whose message could be anything — that's the
    // actual line this story draws, not "400/409/422 only".
    if (error.status >= 400 && error.status < 500) {
      return { kind: "validation", message: error.message };
    }
    return { kind: "generic" };
  }
  return { kind: "network" };
}

export function resolveErrorMessage(
  error: unknown,
  copy: { forbidden: string; generic: string; network: string; unauthorized: string },
): string {
  const classified = classifyError(error);
  switch (classified.kind) {
    case "forbidden":
      return copy.forbidden;
    case "unauthorized":
      return copy.unauthorized;
    case "network":
      return copy.network;
    case "validation":
      return classified.message;
    case "generic":
      return copy.generic;
  }
}
