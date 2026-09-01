import { ApiError } from "./api";

/**
 * Story 94 — classifies a query/mutation error into how the UI should
 * render it. Fixes the Recon's systemic finding: nearly every create-form
 * and several row-mutations in this codebase did
 * `error instanceof ApiError ? error.message : t("...Failed")` for any
 * non-403 `ApiError` — meaning a genuine, unexpected 500 showed the same
 * raw backend text a deliberate 400/409 validation message would. The
 * distinction that actually matters is *not* "403 or not" but "does this
 * status carry a message our own backend deliberately wrote for the user
 * to read" (400 validation, 409 conflict, 422) vs. "everything else,
 * which must never be shown raw."
 *
 * `forbidden`/`unauthorized`/`generic` intentionally carry no text here —
 * every existing call site already has its own feature-scoped translated
 * copy (`t("list.actionForbidden")`, `t("list.actionFailed")`, etc.); this
 * only decides which one applies. `validation` is the one case that does
 * carry backend text, because that text is real, deliberate, user-facing
 * feedback from our own DTO validation/conflict checks — not an internal
 * exception dump — so showing it verbatim is correct, not a defect.
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
    // curated message meant for the caller to read — `NotFoundException`,
    // `BadRequestException`, `ConflictException`, etc. all set their own
    // text. A 5xx, by contrast, is an unexpected server-side failure whose
    // message could be anything (including something stack-trace-adjacent)
    // — that's the actual line this story draws, not "400/409/422 only".
    if (error.status >= 400 && error.status < 500) {
      return { kind: "validation", message: error.message };
    }
    return { kind: "generic" };
  }
  // Not an ApiError at all: `attempt()` (apps/web/src/lib/api.ts) only ever
  // throws ApiError for a real HTTP response, so anything else reaching
  // here is a network-level failure (fetch rejected before a response
  // existed) or an unexpected thrown value — both are presented the same,
  // translated "network/unreachable" way, never as backend text.
  return { kind: "network" };
}

/**
 * Resolves a classified error to display text, given the caller's own
 * already-translated feature-scoped copy for the two cases every existing
 * component in this codebase already has strings for (`forbidden`/
 * `generic`), plus the two new shared `common.errors.*` strings this story
 * adds for the two cases no feature previously had copy for at all
 * (`network`, `unauthorized`).
 */
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
