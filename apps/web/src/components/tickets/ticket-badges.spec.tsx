import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { TicketPriorityBadge, TicketStatusBadge } from "./ticket-badges";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

/**
 * Story 191 (RD-1.14) — every status and priority is tone + icon + localized
 * label, per docs/architecture/13-design-language.md "Status semantics".
 */
const CATALOGS = { en: enMessages, ar: arMessages } as const;

const STATUS_SURFACE = {
  OPEN: "bg-info-surface",
  IN_PROGRESS: "bg-progress-surface",
  RESOLVED: "bg-success-surface",
  CLOSED: "bg-surface-muted",
} as const;

const PRIORITY_SURFACE = {
  LOW: "bg-surface-muted",
  MEDIUM: "bg-surface-muted",
  HIGH: "bg-warning-surface",
  URGENT: "bg-danger-surface",
} as const;

function renderIn(locale: keyof typeof CATALOGS, ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function iconPath(badge: HTMLElement): string {
  const svg = badge.querySelector("svg");
  expect(svg).not.toBeNull();
  expect(svg).toHaveAttribute("aria-hidden", "true");
  return svg!.innerHTML;
}

describe("TicketStatusBadge / TicketPriorityBadge", () => {
  for (const locale of ["en", "ar"] as const) {
    const messages = CATALOGS[locale].common;

    for (const [status, surface] of Object.entries(STATUS_SURFACE)) {
      it(`renders status ${status} with its tone, icon and ${locale} label`, () => {
        renderIn(locale, <TicketStatusBadge status={status} />);
        const label = messages.ticketStatus[status as keyof typeof messages.ticketStatus];
        const badge = screen.getByText(label);
        expect(badge).toHaveClass(surface);
        iconPath(badge);
        expect(badge).not.toHaveTextContent(status);
      });
    }

    for (const [priority, surface] of Object.entries(PRIORITY_SURFACE)) {
      it(`renders priority ${priority} with its tone, icon and ${locale} label`, () => {
        renderIn(locale, <TicketPriorityBadge priority={priority} />);
        const label = messages.ticketPriority[priority as keyof typeof messages.ticketPriority];
        const badge = screen.getByText(label);
        expect(badge).toHaveClass(surface);
        iconPath(badge);
        expect(badge).not.toHaveTextContent(priority);
      });
    }
  }

  it("never gives a status and a priority the same coloured tone (OPEN vs HIGH, IN_PROGRESS vs LOW/MEDIUM)", () => {
    expect(STATUS_SURFACE.OPEN).not.toBe(PRIORITY_SURFACE.HIGH);
    expect(STATUS_SURFACE.IN_PROGRESS).not.toBe(PRIORITY_SURFACE.LOW);
    expect(STATUS_SURFACE.IN_PROGRESS).not.toBe(PRIORITY_SURFACE.MEDIUM);
  });

  it("draws a different icon for every status and priority", () => {
    const paths = new Set<string>();
    for (const status of Object.keys(STATUS_SURFACE)) {
      const { container, unmount } = renderIn("en", <TicketStatusBadge status={status} />);
      paths.add(iconPath(container.firstElementChild as HTMLElement));
      unmount();
    }
    for (const priority of Object.keys(PRIORITY_SURFACE)) {
      const { container, unmount } = renderIn("en", <TicketPriorityBadge priority={priority} />);
      paths.add(iconPath(container.firstElementChild as HTMLElement));
      unmount();
    }
    expect(paths.size).toBe(8);
  });

  it("renders an unknown value as a neutral badge instead of throwing", () => {
    const { container } = renderIn("en", <TicketStatusBadge status="ARCHIVED" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).toHaveClass("bg-surface-muted");
    iconPath(badge);
  });
});
