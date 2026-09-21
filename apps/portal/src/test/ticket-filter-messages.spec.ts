/**
 * Story 148 regression guard, mirroring `fetch-state-messages.spec.ts`'s
 * own scope and reasoning exactly.
 *
 * The ticket list's status filter and its badges read their copy through
 * `t(\`status.${ticket.status}\`)` — a template key, so TypeScript cannot
 * check it and a missing entry would not fail the build. next-intl would
 * render the key path itself, and a customer would read the literal text
 * `status.IN_PROGRESS`. That is exactly the raw-enum problem this story set
 * out to remove, so it is worth a test rather than a convention.
 *
 * Deliberately scoped to the keys this story introduced, not a sweep of the
 * whole catalog — that is a separate concern.
 */
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

const CATALOGS = { en, ar } as const;

/** The four `TicketStatus` values in `apps/api/prisma/schema.prisma`, which
 * is also exactly what `TicketListView`'s `STATUSES` offers. */
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

/** The findability copy the list needs; every one is a required prop on a
 * `@crm/ui` primitive that owns no strings of its own. */
const FILTER_KEYS = [
  "searchLabel",
  "searchPlaceholder",
  "filterStatus",
  "filterAll",
  "clearFilters",
  "noResults",
  "resultCount",
] as const;

describe("ticket filter messages", () => {
  for (const [locale, messages] of Object.entries(CATALOGS)) {
    describe(locale, () => {
      for (const status of STATUSES) {
        it(`has a label for ${status}`, () => {
          const label = messages.tickets.status[status];
          expect(label).toBeTypeOf("string");
          expect(label.trim()).not.toBe("");
          // Not the raw enum value dressed up as a translation.
          expect(label).not.toBe(status);
        });
      }

      for (const key of FILTER_KEYS) {
        it(`has list.${key}`, () => {
          const value = messages.tickets.list[key];
          expect(value).toBeTypeOf("string");
          expect(value.trim()).not.toBe("");
        });
      }
    });
  }

  it("gives every status a distinct label, in both locales", () => {
    // Two statuses collapsing to the same word would make the filter
    // ambiguous rather than merely untranslated.
    for (const messages of Object.values(CATALOGS)) {
      const labels = STATUSES.map((status) => messages.tickets.status[status]);
      expect(new Set(labels).size).toBe(STATUSES.length);
    }
  });

  it("actually translates the status labels and the filter copy into Arabic", () => {
    for (const status of STATUSES) {
      expect(ar.tickets.status[status]).not.toBe(en.tickets.status[status]);
      // Arabic script, not a latin placeholder left behind.
      expect(ar.tickets.status[status]).toMatch(/[؀-ۿ]/);
    }
    for (const key of FILTER_KEYS) {
      expect(ar.tickets.list[key]).not.toBe(en.tickets.list[key]);
      expect(ar.tickets.list[key]).toMatch(/[؀-ۿ]/);
    }
  });

  it("gives resultCount the plural categories its locale actually uses", () => {
    // English needs `one`/`other`; Arabic needs all six, or a count of 2
    // (`two`) silently falls through to `other` and reads wrong.
    expect(en.tickets.list.resultCount).toContain("one {");
    expect(en.tickets.list.resultCount).toContain("other {");
    for (const category of ["zero {", "one {", "two {", "few {", "many {", "other {"]) {
      expect(ar.tickets.list.resultCount).toContain(category);
    }
  });
});
