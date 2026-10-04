import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { SlaIndicator } from "./sla-indicator";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

let locale = "en";
vi.mock("next/navigation", () => ({ useParams: () => ({ locale }) }));

const CATALOGS = { en: enMessages, ar: arMessages } as const;
const now = new Date("2024-01-01T12:00:00.000Z");
const MIN = 60_000;
const at = (ms: number) => new Date(now.getTime() + ms).toISOString();

function renderIn(l: keyof typeof CATALOGS, ui: ReactNode) {
  locale = l;
  return render(
    <NextIntlClientProvider locale={l} messages={CATALOGS[l]} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Story 192 (RD-1.15) — SlaIndicator: the same information as before plus
 * the governing target, the D3 at-risk tier and a localized duration. */
describe("SlaIndicator", () => {
  it("shows the subtle 'no SLA target' text", () => {
    renderIn("en", <SlaIndicator target={null} now={now} />);
    expect(screen.getByText("No SLA target")).toHaveClass("text-ink-subtle");
  });

  it("shows the governing target and remaining time while on track", () => {
    renderIn(
      "en",
      <SlaIndicator
        target={{
          responseTargetAt: at(5 * 60 * MIN + 15 * MIN),
          resolutionTargetAt: at(48 * 60 * MIN),
        }}
        createdAt={at(-60 * MIN)}
        now={now}
      />,
    );
    const text = screen.getByText("Response due in 5h 15m");
    expect(text).toHaveClass("text-ink-strong");
    expect(text.querySelector("svg")).toBeNull();
  });

  it("names the resolution target when it governs", () => {
    renderIn(
      "en",
      <SlaIndicator
        target={{ responseTargetAt: at(48 * 60 * MIN), resolutionTargetAt: at(3 * 60 * MIN) }}
        now={now}
      />,
    );
    expect(screen.getByText("Resolution due in 3h 0m")).toBeInTheDocument();
  });

  it("raises the at-risk tier as a warning badge with an icon and screen-reader text", () => {
    renderIn(
      "en",
      <SlaIndicator
        target={{ responseTargetAt: at(45 * MIN), resolutionTargetAt: at(48 * 60 * MIN) }}
        now={now}
      />,
    );
    const badge = screen.getByText(/Response due in 45m/);
    expect(badge).toHaveClass("bg-warning-surface");
    expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(badge).toHaveTextContent("At risk: Response due in 45m");
    expect(screen.getByText("At risk:")).toHaveClass("sr-only");
  });

  it("shows a breach as a danger badge with an icon and the governing target", () => {
    renderIn(
      "en",
      <SlaIndicator
        target={{ responseTargetAt: at(-MIN), resolutionTargetAt: at(48 * 60 * MIN) }}
        now={now}
      />,
    );
    const badge = screen.getByText("Response breached");
    expect(badge).toHaveClass("bg-danger-surface");
    expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it("adds the breach time in the detail variant", () => {
    renderIn(
      "en",
      <SlaIndicator
        variant="detail"
        target={{ responseTargetAt: at(48 * 60 * MIN), resolutionTargetAt: at(-MIN) }}
        now={now}
      />,
    );
    expect(screen.getByText(/^Resolution breached at /)).toBeInTheDocument();
  });

  it("shows on-hold as a neutral badge, with the time in the detail variant", () => {
    const held = {
      responseTargetAt: at(-MIN),
      resolutionTargetAt: at(MIN),
      onHoldSince: at(-30 * MIN),
    };
    const { unmount } = renderIn("en", <SlaIndicator target={held} now={now} />);
    expect(screen.getByText("On hold")).toHaveClass("bg-surface-muted");
    unmount();
    renderIn("en", <SlaIndicator variant="detail" target={held} now={now} />);
    expect(screen.getByText(/^On hold since /)).toBeInTheDocument();
  });

  // D4 keeps the current `Intl` `ar` digits, whichever numbering system the
  // runtime's ICU gives `ar`; the units are always Arabic words.
  it("localizes the duration in Arabic: no Latin h/m, the locale's own digits", () => {
    const { container } = renderIn(
      "ar",
      <SlaIndicator
        target={{
          responseTargetAt: at(5 * 60 * MIN + 15 * MIN),
          resolutionTargetAt: at(48 * 60 * MIN),
        }}
        createdAt={at(-60 * MIN)}
        now={now}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("الاستجابة");
    const digits = new Intl.NumberFormat("ar");
    expect(text).toContain(`${digits.format(5)} س ${digits.format(15)} د`);
    expect(text).not.toMatch(/[A-Za-z]/);
  });

  it("localizes 'under a minute' in Arabic", () => {
    const { container } = renderIn(
      "ar",
      <SlaIndicator
        target={{ responseTargetAt: at(30_000), resolutionTargetAt: at(48 * 60 * MIN) }}
        now={now}
      />,
    );
    expect(container.textContent).toContain("أقل من دقيقة");
    expect(container.textContent).not.toMatch(/[A-Za-z]/);
  });
});
