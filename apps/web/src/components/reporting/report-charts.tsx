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
 * Ticket-status bar colors mirror `ticket-badges.ts`'s own
 * `ticketStatusBadgeVariant` semantic exactly (OPEN=amber/"needs
 * attention", RESOLVED=green/"good terminal state", CLOSED=quiet neutral,
 * IN_PROGRESS=neutral "owned, no action required") — the same mapping a
 * ticket's own status Badge already uses elsewhere in this app, not a
 * second, independently-invented color scheme.
 */

/** One bar segment within a chart row — `label` is only rendered when a
 * row has more than one segment (a single-series row's own row label
 * already says what the bar means; a multi-series row needs each segment
 * named, e.g. "Open"/"Resolved"). */
export interface BarSegment {
  label: string;
  value: number;
  color: string;
}

export interface BarChartRow {
  label: string;
  segments: BarSegment[];
}

/**
 * A horizontal bar chart — one or more colored segments per row, each
 * scaled against the largest single segment value across every row (not
 * per-row), so bars are visually comparable across the whole chart.
 * `ariaLabel` is the only accessible description (the bars themselves are
 * `aria-hidden` via the wrapping `role="img"`), so it must summarize every
 * row's real values — never left to a screen reader to infer from pixel
 * widths.
 */
export function BarChart({
  rows,
  ariaLabel,
}: {
  rows: BarChartRow[];
  ariaLabel: string;
}) {
  const maxValue = Math.max(1, ...rows.flatMap((row) => row.segments.map((segment) => segment.value)));

  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-700">{row.label}</span>
          {row.segments.map((segment, index) => (
            <div key={`${row.label}-${index}`} className="flex items-center gap-2">
              {row.segments.length > 1 && (
                <span className="w-16 shrink-0 text-xs text-slate-500">{segment.label}</span>
              )}
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(segment.value / maxValue) * 100}%`,
                    backgroundColor: segment.color,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-900">
                {segment.value}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A circular percentage gauge (SLA compliance rate) — a plain SVG ring,
 * the un-filled portion drawn first in a neutral rule color, the filled
 * portion drawn over it via `strokeDasharray`, rotated so the fill starts
 * at 12 o'clock. */
export function DonutGauge({
  percent,
  color,
  ariaLabel,
}: {
  percent: number;
  color: string;
  ariaLabel: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / 100) * circumference;

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-24 w-24"
      role="img"
      aria-label={ariaLabel}
    >
      <circle cx="50" cy="50" r={radius} fill="none" stroke="rgb(var(--rule))" strokeWidth="10" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-slate-900 text-[22px] font-semibold"
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

/** A single-value rating bar (CSAT's average rating, 0-5) — the same
 * horizontal-bar visual language as `BarChart`, scaled to a fixed 0-5
 * range instead of the tallest value present. */
export function RatingBar({ rating, ariaLabel }: { rating: number; ariaLabel: string }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <div role="img" aria-label={ariaLabel} className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${(clamped / 5) * 100}%`, backgroundColor: "rgb(var(--warning-solid))" }}
        />
      </div>
      <span className="text-sm font-medium text-slate-900">{clamped.toFixed(1)}/5</span>
    </div>
  );
}

/** Mirrors `ticket-badges.ts`'s own `ticketStatusBadgeVariant` semantic
 * exactly, translated to the solid chart-fill token each Badge variant's
 * surface/foreground pair is built from — see this file's own top doc
 * comment for why. */
export function ticketStatusBarColor(status: string): string {
  if (status === "OPEN") return "rgb(var(--warning-solid))";
  if (status === "RESOLVED") return "rgb(var(--success-solid))";
  if (status === "CLOSED") return "rgb(var(--rule-strong))";
  return "rgb(var(--ink-subtle))"; // IN_PROGRESS
}
