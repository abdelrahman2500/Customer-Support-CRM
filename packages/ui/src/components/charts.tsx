import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 211 (PR-1.2) — the chart primitives, moved here from the web
 * reports screen (RM-08's dependency-free inline SVG/CSS charts) so the
 * dashboard, reports and portal share one set. Colours are passed in as CSS
 * colours (`rgb(var(--viz-1))`, a status tone's solid) — never branded — and
 * every chart has a text equivalent: `role="img"` with an `aria-label` that
 * states the values, plus visible labels and numbers, so colour is never
 * the only carrier of meaning.
 */

/** One bar segment within a chart row — `label` is only rendered when a
 * row has more than one segment. */
export interface BarSegment {
  label: string;
  value: number;
  color: string;
}

export interface BarChartRow {
  label: string;
  segments: BarSegment[];
  /** A stable identity when labels can repeat (two agents with one name). */
  id?: string;
}

/** Horizontal bars, all scaled against the largest single segment value so
 * bars are comparable across rows. */
export function BarChart({ rows, ariaLabel }: { rows: BarChartRow[]; ariaLabel: string }) {
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => row.segments.map((segment) => segment.value)),
  );

  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-3">
      {rows.map((row, rowIndex) => (
        <div key={row.id ?? `row-${rowIndex}`} className="flex flex-col gap-1">
          <span className="break-words text-xs font-medium text-ink-strong">{row.label}</span>
          {row.segments.map((segment, index) => (
            <div
              key={`${row.id ?? `row-${rowIndex}`}-${index}`}
              className="flex items-center gap-2"
            >
              {row.segments.length > 1 && (
                <span className="w-16 shrink-0 text-xs text-ink-subtle">{segment.label}</span>
              )}
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(segment.value / maxValue) * 100}%`,
                    backgroundColor: segment.color,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-end text-xs font-medium tabular-nums text-ink">
                {segment.value}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A circular percentage gauge; the fill starts at 12 o'clock. */
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
    <svg viewBox="0 0 100 100" className="h-24 w-24" role="img" aria-label={ariaLabel}>
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
        fontSize="22"
        className="fill-ink font-semibold tabular-nums"
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

/** A single value on a fixed 0–5 scale (CSAT's average rating). */
export function RatingBar({ rating, ariaLabel }: { rating: number; ariaLabel: string }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <div role="img" aria-label={ariaLabel} className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${(clamped / 5) * 100}%`, backgroundColor: "rgb(var(--warning-solid))" }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums text-ink">{clamped.toFixed(1)}/5</span>
    </div>
  );
}

export interface DistributionSegment {
  key: string;
  label: string;
  value: number;
  /** Background utility for the segment and its legend dot, e.g. "bg-info-solid". */
  tone: string;
  /** Makes the legend item a link (e.g. to the matching board column). */
  href?: string;
}

/**
 * Story 211 — parts of a whole in one stacked bar (tickets by status), with a
 * legend that names every part and its count. Zero-value parts keep their
 * legend entry. Legend items with `href` render through `linkAs` (the app's
 * router link; a plain `<a>` by default).
 */
export function DistributionBar({
  segments,
  ariaLabel,
  linkAs: Link = "a",
  className,
}: {
  segments: DistributionSegment[];
  ariaLabel: string;
  linkAs?: React.ElementType;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className={cn("flex flex-col gap-stack", className)}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-3 w-full overflow-hidden rounded-pill bg-surface-muted"
      >
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <div
                key={segment.key}
                className={cn("h-full first:rounded-s-pill last:rounded-e-pill", segment.tone)}
                style={{ width: `${(segment.value / total) * 100}%` }}
              />
            ))}
      </div>
      <ul className="flex flex-wrap gap-x-section gap-y-2">
        {segments.map((segment) => {
          const content = (
            <>
              <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-pill", segment.tone)} />
              <span className="text-sm text-ink-muted">{segment.label}</span>
              <span className="text-sm font-semibold tabular-nums text-ink">{segment.value}</span>
            </>
          );
          return (
            <li key={segment.key}>
              {segment.href ? (
                <Link
                  href={segment.href}
                  className="focus-ring inline-flex items-center gap-tight rounded-inner hover:underline"
                >
                  {content}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-tight">{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
