import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart, DonutGauge, RatingBar, ticketStatusBarColor } from "./report-charts";

describe("BarChart", () => {
  it("renders one role=img element carrying the given accessible label", () => {
    render(
      <BarChart
        ariaLabel="OPEN: 3, RESOLVED: 5"
        rows={[
          { label: "OPEN", segments: [{ label: "", value: 3, color: "red" }] },
          { label: "RESOLVED", segments: [{ label: "", value: 5, color: "green" }] },
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "OPEN: 3, RESOLVED: 5" })).toBeInTheDocument();
  });

  it("renders each row's label and each segment's value as visible text", () => {
    render(
      <BarChart
        ariaLabel="chart"
        rows={[{ label: "OPEN", segments: [{ label: "", value: 7, color: "red" }] }]}
      />,
    );

    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("does not render a segment sub-label for a single-series row", () => {
    render(
      <BarChart
        ariaLabel="chart"
        rows={[{ label: "OPEN", segments: [{ label: "Should not appear", value: 1, color: "red" }] }]}
      />,
    );

    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });

  it("renders each segment's own sub-label for a multi-series row", () => {
    render(
      <BarChart
        ariaLabel="chart"
        rows={[
          {
            label: "Jane Agent",
            segments: [
              { label: "Open", value: 2, color: "amber" },
              { label: "Resolved", value: 5, color: "green" },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("scales each bar's width against the largest single segment value across every row", () => {
    const { container } = render(
      <BarChart
        ariaLabel="chart"
        rows={[
          { label: "small", segments: [{ label: "", value: 1, color: "red" }] },
          { label: "big", segments: [{ label: "", value: 4, color: "red" }] },
        ]}
      />,
    );

    const bars = container.querySelectorAll<HTMLElement>(".rounded-full[style*='width']");
    expect(bars[0]?.style.width).toBe("25%");
    expect(bars[1]?.style.width).toBe("100%");
  });

  it("never divides by zero when every value is 0", () => {
    const { container } = render(
      <BarChart
        ariaLabel="chart"
        rows={[{ label: "none", segments: [{ label: "", value: 0, color: "red" }] }]}
      />,
    );

    const bar = container.querySelector<HTMLElement>(".rounded-full[style*='width']");
    expect(bar?.style.width).toBe("0%");
  });
});

describe("DonutGauge", () => {
  it("renders as an accessible role=img with the given label", () => {
    render(<DonutGauge percent={72} color="green" ariaLabel="72%" />);

    expect(screen.getByRole("img", { name: "72%" })).toBeInTheDocument();
  });

  it("renders the rounded percentage as SVG text", () => {
    render(<DonutGauge percent={72.6} color="green" ariaLabel="73%" />);

    expect(screen.getByText("73%")).toBeInTheDocument();
  });

  it("clamps a percent above 100 to 100", () => {
    render(<DonutGauge percent={150} color="green" ariaLabel="100%" />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps a negative percent to 0", () => {
    render(<DonutGauge percent={-10} color="green" ariaLabel="0%" />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("RatingBar", () => {
  it("renders as an accessible role=img with the given label", () => {
    render(<RatingBar rating={4.5} ariaLabel="4.5/5" />);

    expect(screen.getByRole("img", { name: "4.5/5" })).toBeInTheDocument();
  });

  it("renders the rating formatted to one decimal place out of 5", () => {
    render(<RatingBar rating={3} ariaLabel="3.0/5" />);

    expect(screen.getByText("3.0/5")).toBeInTheDocument();
  });

  it("clamps a rating above 5 to 5", () => {
    render(<RatingBar rating={9} ariaLabel="5.0/5" />);

    expect(screen.getByText("5.0/5")).toBeInTheDocument();
  });
});

describe("ticketStatusBarColor", () => {
  it("mirrors ticket-badges.ts's own ticketStatusBadgeVariant semantic (OPEN/RESOLVED/CLOSED distinct, IN_PROGRESS neutral fallback)", () => {
    expect(ticketStatusBarColor("OPEN")).toBe("rgb(var(--warning-solid))");
    expect(ticketStatusBarColor("RESOLVED")).toBe("rgb(var(--success-solid))");
    expect(ticketStatusBarColor("CLOSED")).toBe("rgb(var(--rule-strong))");
    expect(ticketStatusBarColor("IN_PROGRESS")).toBe("rgb(var(--ink-subtle))");
  });
});
