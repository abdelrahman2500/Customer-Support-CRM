import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import type { TicketStatus } from "@prisma/client";
import { assertValidTicketStatusTransition, TICKET_STATUS_TRANSITIONS } from "./ticket-status-transitions";

const ALL_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

describe("ticket-status-transitions", () => {
  describe("TICKET_STATUS_TRANSITIONS (the real, production policy)", () => {
    it("allows every status to move to every other status, including itself", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          expect(() => assertValidTicketStatusTransition(from, to)).not.toThrow();
        }
      }
    });

    // The two "skip a step" transitions the original speculative framing
    // of this gap assumed were illegal — explicitly named here since
    // they're the whole reason this story's premise had to be
    // re-verified against actual repository evidence before implementing
    // anything.
    it("allows IN_PROGRESS -> CLOSED (skips RESOLVED)", () => {
      expect(() => assertValidTicketStatusTransition("IN_PROGRESS", "CLOSED")).not.toThrow();
    });

    it("allows RESOLVED -> OPEN (skips IN_PROGRESS)", () => {
      expect(() => assertValidTicketStatusTransition("RESOLVED", "OPEN")).not.toThrow();
    });

    it("lists all 4 statuses for every status, so the table is self-evidently exhaustive at a glance", () => {
      for (const from of ALL_STATUSES) {
        expect(TICKET_STATUS_TRANSITIONS[from]).toEqual(ALL_STATUSES);
      }
    });
  });

  // The guard mechanism's own rejection behavior, proven independently of
  // whether the real, production table above happens to allow everything —
  // exercised against a deliberately narrow table passed explicitly.
  describe("assertValidTicketStatusTransition's rejection behavior (narrow test-only table)", () => {
    const NARROW_TABLE: Record<TicketStatus, TicketStatus[]> = {
      OPEN: ["IN_PROGRESS"],
      IN_PROGRESS: ["RESOLVED"],
      RESOLVED: ["CLOSED"],
      CLOSED: [],
    };

    it("does not throw for a transition the table lists", () => {
      expect(() =>
        assertValidTicketStatusTransition("OPEN", "IN_PROGRESS", NARROW_TABLE),
      ).not.toThrow();
    });

    it("throws BadRequestException for a transition the table does not list", () => {
      expect(() => assertValidTicketStatusTransition("OPEN", "CLOSED", NARROW_TABLE)).toThrow(
        BadRequestException,
      );
    });

    it("names the attempted transition in the error message", () => {
      expect(() => assertValidTicketStatusTransition("OPEN", "CLOSED", NARROW_TABLE)).toThrow(
        "Cannot move ticket from OPEN to CLOSED",
      );
    });

    it("rejects every transition out of a status the table maps to an empty list", () => {
      for (const to of ALL_STATUSES) {
        expect(() => assertValidTicketStatusTransition("CLOSED", to, NARROW_TABLE)).toThrow(
          BadRequestException,
        );
      }
    });

    it("treats same-status as illegal when the table does not explicitly list it as reachable from itself", () => {
      // NARROW_TABLE.OPEN does not include "OPEN" — proves this function
      // never special-cases same-status as an implicit no-op; that
      // guarantee comes entirely from the real table listing every
      // status as reachable from itself, not from this function's logic.
      expect(() => assertValidTicketStatusTransition("OPEN", "OPEN", NARROW_TABLE)).toThrow(
        BadRequestException,
      );
    });
  });
});
