/**
 * Story 229 (PR-5.1) — the status spine, shared by both apps so a customer
 * and an agent see a ticket's status in the same hue. Moved here from the
 * web board (Story 216): one hue per presentation tone, as the edge of a
 * card or column (`border`), a legend dot (`dot`), a header's top edge
 * (`top`) and — new for the portal's cards — the inline-start edge alone
 * (`start`). Literal class names, so Tailwind generates every one.
 *
 * Keyed by tone, not by status: `@crm/shared`'s `ticketStatusPresentation`
 * maps a status to its tone, and this package stays free of domain types.
 */
export type SpineTone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

export interface Spine {
  border: string;
  dot: string;
  top: string;
  /** The inline-start edge only (a card whose other edges stay neutral). */
  start: string;
}

const SPINE: Record<SpineTone, Spine> = {
  info: {
    border: "border-info-solid",
    dot: "bg-info-solid",
    top: "border-t-info-solid",
    start: "border-s-info-solid",
  },
  progress: {
    border: "border-progress-solid",
    dot: "bg-progress-solid",
    top: "border-t-progress-solid",
    start: "border-s-progress-solid",
  },
  success: {
    border: "border-success-solid",
    dot: "bg-success-solid",
    top: "border-t-success-solid",
    start: "border-s-success-solid",
  },
  neutral: {
    border: "border-rule-control",
    dot: "bg-rule-control",
    top: "border-t-rule-control",
    start: "border-s-rule-control",
  },
  warning: {
    border: "border-warning-solid",
    dot: "bg-warning-solid",
    top: "border-t-warning-solid",
    start: "border-s-warning-solid",
  },
  danger: {
    border: "border-danger-solid",
    dot: "bg-danger-solid",
    top: "border-t-danger-solid",
    start: "border-s-danger-solid",
  },
};

export function toneSpine(tone: SpineTone): Spine {
  return SPINE[tone];
}
