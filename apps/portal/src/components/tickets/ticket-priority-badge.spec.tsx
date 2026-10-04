import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { TicketPriorityBadge } from "./ticket-priority-badge";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

/**
 * Story 193 (RD-1.16) — the portal shows a priority as tone + icon + label,
 * never the raw enum.
 */
const CATALOGS = { en: enMessages, ar: arMessages } as const;

const PRIORITY_SURFACE = {
  LOW: "bg-surface-muted",
  MEDIUM: "bg-surface-muted",
  HIGH: "bg-warning-surface",
  URGENT: "bg-danger-surface",
} as const;

describe("TicketPriorityBadge (portal)", () => {
  for (const locale of ["en", "ar"] as const) {
    for (const [priority, surface] of Object.entries(PRIORITY_SURFACE)) {
      it(`renders ${priority} with its tone, an icon and the ${locale} label`, () => {
        render(
          <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]}>
            <TicketPriorityBadge priority={priority} />
          </NextIntlClientProvider>,
        );
        const priorities = CATALOGS[locale].tickets.priority;
        const badge = screen.getByText(priorities[priority as keyof typeof priorities]);
        expect(badge).toHaveClass(surface);
        expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
        expect(badge).not.toHaveTextContent(priority);
      });
    }
  }
});
