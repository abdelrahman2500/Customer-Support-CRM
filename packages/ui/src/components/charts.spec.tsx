import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart, DistributionBar, DonutGauge, RatingBar } from "./charts";

/** Story 211 (PR-1.2) — the shared chart primitives (moved from web reports;
 * their full behaviour stays covered by apps/web report-charts.spec.tsx). */
describe("charts", () => {
  it("BarChart states its values for assistive tech and in visible numbers", () => {
    render(
      <BarChart
        ariaLabel="OPEN: 3"
        rows={[
          { label: "OPEN", segments: [{ label: "Open", value: 3, color: "rgb(var(--viz-1))" }] },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "OPEN: 3" })).toBeInTheDocument();
    expect(screen.getByText("3")).toHaveClass("tabular-nums");
  });

  it("DonutGauge and RatingBar clamp their values", () => {
    render(
      <>
        <DonutGauge percent={140} color="rgb(var(--success-solid))" ariaLabel="SLA" />
        <RatingBar rating={7} ariaLabel="CSAT" />
      </>,
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("5.0/5")).toBeInTheDocument();
  });

  describe("DistributionBar", () => {
    const segments = [
      { key: "OPEN", label: "Open", value: 6, tone: "bg-info-solid", href: "/t?s=open" },
      { key: "IN_PROGRESS", label: "In progress", value: 2, tone: "bg-progress-solid" },
      { key: "CLOSED", label: "Closed", value: 0, tone: "bg-rule-control" },
    ];

    it("sizes segments by share and names every part, zeros included", () => {
      const { container } = render(
        <DistributionBar ariaLabel="Open 6, In progress 2, Closed 0" segments={segments} />,
      );
      const bar = screen.getByRole("img", { name: "Open 6, In progress 2, Closed 0" });
      const parts = bar.querySelectorAll("div");
      expect(parts).toHaveLength(2);
      expect((parts[0] as HTMLElement).style.width).toBe("75%");
      expect(container.querySelectorAll("li")).toHaveLength(3);
      expect(screen.getByText("Closed")).toBeInTheDocument();
    });

    it("links legend entries that have an href", () => {
      render(<DistributionBar ariaLabel="x" segments={segments} />);
      expect(screen.getByRole("link", { name: /Open\s*6/ })).toHaveAttribute("href", "/t?s=open");
      expect(screen.queryByRole("link", { name: /In progress/ })).not.toBeInTheDocument();
    });
  });
});
