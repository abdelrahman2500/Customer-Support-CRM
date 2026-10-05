import { ticketStatusPresentation, type PresentationTone } from "@crm/shared";

/**
 * RM-08 — Reporting Charts. Plain, dependency-free inline SVG/CSS — recon
 * confirmed zero charting library exists anywhere in this monorepo
 * (`reporting-saved-dashboards`/Story 110's own plan: "This codebase has
 * no charting library anywhere"), and the plan's own guidance is to
 * evaluate a no-dependency inline approach first, given how bounded these
 * four chart shapes are. Three small, reusable primitives shared by the
 * four widgets this story upgrades in `reports-view.tsx`.
 *
 * Colors are read from this app's own design tokens
 * (`rgb(var(--token))`, the same wrapper `tailwind-tokens.css`'s own
 * Tailwind integration uses — see `bg-accent`/`text-ink` etc.) rather than
 * literal hex values. DS-1b shipped light-only tokens by explicit,
 * disclosed design ("adding [dark mode] later is a second `:root` block
 * rather than a sweep through every component") — there is no dark theme
 * to render correctly today, so "respects both themes" is satisfied here
 * by reading the tokens themselves (which a future dark `:root` block
 * would override for every chart at once) rather than hard-coding a
 * palette nothing could ever re-theme.
 *
 * Ticket-status bar colors come from the same tone a ticket's status
 * badge uses (Story 191, `@crm/shared` `ticket-presentation.ts`: OPEN
 * info, IN_PROGRESS progress, RESOLVED success, CLOSED neutral), not a
 * second, independently-invented color scheme.
 */

/** Story 211 (PR-1.2) — the chart primitives moved to `@crm/ui` (shared by
 * the dashboard, reports and portal); re-exported so existing imports keep
 * working. The domain mapping below stays in the app. */
export { BarChart, DonutGauge, RatingBar } from "@crm/ui";
export type { BarChartRow, BarSegment } from "@crm/ui";

/** Story 191 (RD-1.14) — the status's shared tone as a solid chart fill:
 * each semantic family's `-solid` step (fills, not text), and the strong
 * rule for neutral. See this file's own top doc comment for why. */
const TONE_FILL: Record<PresentationTone, string> = {
  neutral: "rgb(var(--rule-strong))",
  info: "rgb(var(--info-solid))",
  progress: "rgb(var(--progress-solid))",
  success: "rgb(var(--success-solid))",
  warning: "rgb(var(--warning-solid))",
  danger: "rgb(var(--danger-solid))",
};

export function ticketStatusBarColor(status: string): string {
  return TONE_FILL[ticketStatusPresentation(status).tone];
}
