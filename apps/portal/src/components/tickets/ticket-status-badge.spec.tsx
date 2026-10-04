import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { TicketStatusBadge } from "./ticket-status-badge";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

/**
 * Story 191 (RD-1.14) — the customer sees the same tone + icon as the agent
 * workspace (shared data), with the portal's own `tickets.status.*` labels.
 */
const CATALOGS = { en: enMessages, ar: arMessages } as const;

const STATUS_SURFACE = {
  OPEN: "bg-info-surface",
  IN_PROGRESS: "bg-progress-surface",
  RESOLVED: "bg-success-surface",
  CLOSED: "bg-surface-muted",
} as const;

describe("TicketStatusBadge (portal)", () => {
  for (const locale of ["en", "ar"] as const) {
    for (const [status, surface] of Object.entries(STATUS_SURFACE)) {
      it(`renders ${status} with its tone, an icon and the ${locale} label`, () => {
        render(
          <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]}>
            <TicketStatusBadge status={status} />
          </NextIntlClientProvider>,
        );
        const statuses = CATALOGS[locale].tickets.status;
        const badge = screen.getByText(statuses[status as keyof typeof statuses]);
        expect(badge).toHaveClass(surface);
        expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
        expect(badge).not.toHaveTextContent(status);
      });
    }
  }
});
