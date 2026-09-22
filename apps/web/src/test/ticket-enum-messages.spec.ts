/**
 * Story 153 regression guard, mirroring the portal's own
 * `apps/portal/src/test/ticket-filter-messages.spec.ts` in shape and reason.
 *
 * `useTicketLabels` reads `common.ticketStatus.<VALUE>` and
 * `common.ticketPriority.<VALUE>` through a template key, which TypeScript
 * cannot check. A missing entry would not fail the build — next-intl renders
 * the key path instead, so an agent would read the literal text
 * `common.ticketStatus.IN_PROGRESS`. That is a worse version of the raw-enum
 * problem this story set out to remove, so it is worth a test rather than a
 * convention.
 *
 * The member lists below are the tripwire for a future enum change: adding a
 * `TicketStatus` value in `schema.prisma` without adding a label here fails
 * this spec.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

const CATALOGS = { en, ar } as const;

/** `TicketStatus` — `apps/api/prisma/schema.prisma` enum. */
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

/**
 * `TicketPriority` — and `TaskPriority`, which has identical members and is
 * deliberately served by the same labels (see `use-ticket-labels.ts`).
 */
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

describe("ticket enum messages", () => {
  for (const [locale, messages] of Object.entries(CATALOGS)) {
    describe(locale, () => {
      for (const status of STATUSES) {
        it(`has a label for status ${status}`, () => {
          const label = messages.common.ticketStatus[status];
          expect(label).toBeTypeOf("string");
          expect(label.trim()).not.toBe("");
          // Not the raw enum dressed up as a translation.
          expect(label).not.toBe(status);
        });
      }

      for (const priority of PRIORITIES) {
        it(`has a label for priority ${priority}`, () => {
          const label = messages.common.ticketPriority[priority];
          expect(label).toBeTypeOf("string");
          expect(label.trim()).not.toBe("");
          expect(label).not.toBe(priority);
        });
      }
    });
  }

  it("gives every value a distinct label, in both locales", () => {
    // Two statuses collapsing to one word would make a badge ambiguous.
    for (const messages of Object.values(CATALOGS)) {
      const statuses = STATUSES.map((s) => messages.common.ticketStatus[s]);
      const priorities = PRIORITIES.map((p) => messages.common.ticketPriority[p]);
      expect(new Set(statuses).size).toBe(STATUSES.length);
      expect(new Set(priorities).size).toBe(PRIORITIES.length);
    }
  });

  it("actually translates every label into Arabic", () => {
    for (const status of STATUSES) {
      expect(ar.common.ticketStatus[status]).not.toBe(en.common.ticketStatus[status]);
      // Arabic script, not a latin placeholder left behind.
      expect(ar.common.ticketStatus[status]).toMatch(/[؀-ۿ]/);
    }
    for (const priority of PRIORITIES) {
      expect(ar.common.ticketPriority[priority]).not.toBe(en.common.ticketPriority[priority]);
      expect(ar.common.ticketPriority[priority]).toMatch(/[؀-ۿ]/);
    }
  });

  it("uses the same status wording as the portal, so the two apps agree", () => {
    // A customer and an agent looking at the same ticket must read the same
    // word for its state. The portal localised these first (Story 148) under
    // `tickets.status`; this app placed them under `common.ticketStatus` for
    // its own namespace reasons (see `use-ticket-labels.ts`). The placement
    // differs deliberately — the wording must not.
    //
    // Read from disk rather than imported: the portal is a separate Vitest
    // project with its own `src` root, the same reason
    // `table-mobile-labels.spec.ts` reads across app roots with `fs`.
    const portalDir = path.resolve(__dirname, "../../../portal/messages");
    for (const locale of ["en", "ar"] as const) {
      const portal = JSON.parse(readFileSync(path.join(portalDir, `${locale}.json`), "utf8")) as {
        tickets: { status: Record<string, string> };
      };
      for (const status of STATUSES) {
        expect(CATALOGS[locale].common.ticketStatus[status]).toBe(portal.tickets.status[status]);
      }
    }
  });
});
