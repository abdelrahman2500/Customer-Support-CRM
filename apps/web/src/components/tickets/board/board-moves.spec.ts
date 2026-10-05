import { describe, expect, it, vi } from "vitest";
import {
  changedElsewhere,
  changedSince,
  columnCoordinates,
  snapshotOf,
  compareForSort,
  insertIntoPages,
  needsConfirmation,
  removeFromPages,
  type ColumnPages,
} from "./board-moves";
import type { TicketListItem } from "@/lib/tickets-api";

/** Story 217 (PR-3.2, tickets-kanban-ux.md §5) — the move rules. */
function ticket(id: string, fields: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id,
    subject: id,
    status: "OPEN",
    priority: "MEDIUM",
    createdAt: "2026-10-05T08:00:00Z",
    updatedAt: "2026-10-05T08:00:00Z",
    slaTarget: null,
    ...fields,
  } as TicketListItem;
}

function sla(responseTargetAt: string) {
  return {
    slaTarget: {
      id: "s",
      slaPolicyId: "p",
      responseTargetAt,
      resolutionTargetAt: "2026-10-09T00:00:00Z",
      onHoldSince: null,
    },
  } as Partial<TicketListItem>;
}

function pages(...chunks: TicketListItem[][]): ColumnPages {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + 10;
  return {
    pageParams: chunks.map((_, index) => index + 1),
    pages: chunks.map((items, index) => ({
      items,
      total,
      page: index + 1,
      pageSize: 25,
      totalPages: chunks.length + 1,
    })),
  };
}

const ids = (data: ColumnPages) => data.pages.map((page) => page.items.map((item) => item.id));

describe("board moves", () => {
  it("confirms only the moves that notify the customer (PD-5)", () => {
    expect(needsConfirmation("RESOLVED")).toBe(true);
    expect(needsConfirmation("CLOSED")).toBe(true);
    expect(needsConfirmation("OPEN")).toBe(false);
    expect(needsConfirmation("IN_PROGRESS")).toBe(false);
  });

  it("orders like the API: SLA urgency by response target, no target last", () => {
    const sorted = [
      ticket("none"),
      ticket("late", sla("2026-10-05T12:00:00Z")),
      ticket("soon", sla("2026-10-05T09:00:00Z")),
    ].sort(compareForSort("slaUrgency"));
    expect(sorted.map((item) => item.id)).toEqual(["soon", "late", "none"]);
    const byNewest = [
      ticket("a", { createdAt: "2026-10-01T00:00:00Z" }),
      ticket("b", { createdAt: "2026-10-03T00:00:00Z" }),
    ].sort(compareForSort("newest"));
    expect(byNewest.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("removes a card from whichever page holds it and lowers the total", () => {
    const data = pages([ticket("a"), ticket("b")], [ticket("c")]);
    const next = removeFromPages(data, "c");
    expect(ids(next)).toEqual([["a", "b"], []]);
    expect(next.pages[0]!.total).toBe(data.pages[0]!.total - 1);
    expect(removeFromPages(data, "missing")).toBe(data);
  });

  it("inserts a card at its sorted position, or at the end of the loaded pages", () => {
    const data = pages(
      [ticket("t9", sla("2026-10-05T09:00:00Z")), ticket("t12", sla("2026-10-05T12:00:00Z"))],
      [ticket("t15", sla("2026-10-05T15:00:00Z"))],
    );
    const middle = insertIntoPages(data, ticket("t10", sla("2026-10-05T10:00:00Z")), "slaUrgency");
    expect(ids(middle)).toEqual([["t9", "t10", "t12"], ["t15"]]);
    expect(middle.pages[0]!.total).toBe(data.pages[0]!.total + 1);

    const last = insertIntoPages(data, ticket("none"), "slaUrgency");
    expect(ids(last)).toEqual([
      ["t9", "t12"],
      ["t15", "none"],
    ]);
    // "Recently updated": a just-moved card is the newest update, so first.
    const updated = insertIntoPages(
      data,
      ticket("now", { updatedAt: "2026-10-06T00:00:00Z" }),
      "updated",
    );
    expect(ids(updated)[0]![0]).toBe("now");
  });

  describe("keyboard drag between columns", () => {
    // Four 280px columns side by side; in RTL the first column is on the right.
    const rects = new Map(
      [0, 1, 2, 3].map((index) => [
        `c${index}`,
        { left: index * 300, width: 280, top: 0, height: 600, right: 0, bottom: 0 },
      ]),
    );
    // dnd-kit passes the dragged rect's top-left; the card is 200px wide, so
    // a card centred at `center` has its left edge at `center - 100`.
    const args = (center: number) =>
      ({
        currentCoordinates: { x: center - 100, y: 100 },
        active: "t1",
        context: { droppableRects: rects, collisionRect: { width: 200 } },
      }) as never;
    const centredOn = (center: number) => ({ x: center - 100, y: 100 });
    const key = (code: string) => ({ code, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

    it("jumps to the nearest column in the arrow's visual direction, centring the card on it", () => {
      expect(columnCoordinates(key("ArrowRight"), args(140))).toEqual(centredOn(440));
      expect(columnCoordinates(key("ArrowLeft"), args(440))).toEqual(centredOn(140));
      // At the edge it stays put rather than wrapping.
      expect(columnCoordinates(key("ArrowRight"), args(1040))).toEqual(centredOn(1040));
    });

    it("so in RTL (columns laid out right to left) ← is the next column", () => {
      // The Open column sits at the far right (centre 1040); "next" is to its left.
      expect(columnCoordinates(key("ArrowLeft"), args(1040))).toEqual(centredOn(740));
    });

    it("ignores other keys (no pixel nudging inside a column)", () => {
      expect(columnCoordinates(key("ArrowDown"), args(140))).toBeUndefined();
    });
  });

  describe("change cues (Story 218)", () => {
    const at = (iso: string) => new Date(iso).getTime();
    const before = [
      ticket("a", { updatedAt: "2026-10-05T10:00:00Z", assignedToUserId: "u1" }),
      ticket("b", { updatedAt: "2026-10-05T10:05:00Z" }),
    ];
    const previous = snapshotOf(before, at("2026-10-05T10:06:00Z"));

    it("cues cards that arrived or were re-assigned / re-prioritised after the last fetch", () => {
      const after = [
        ticket("a", { updatedAt: "2026-10-05T10:07:00Z", assignedToUserId: "u2" }),
        ticket("b", { updatedAt: "2026-10-05T10:05:00Z" }),
        ticket("new", { updatedAt: "2026-10-05T10:07:30Z" }),
        ticket("prio", { updatedAt: "2026-10-05T10:01:00Z" }),
      ];
      expect(changedSince(previous, after, new Set())).toEqual(["a", "new"]);
    });

    it("ignores a new message (same fields), the agent's own moves and older cards sliding in", () => {
      const after = [
        ticket("a", { updatedAt: "2026-10-05T10:08:00Z", assignedToUserId: "u1" }),
        ticket("mine", { updatedAt: "2026-10-05T10:08:00Z" }),
        ticket("old", { updatedAt: "2026-10-05T08:00:00Z" }),
      ];
      expect(changedSince(previous, after, new Set(["mine"]))).toEqual([]);
    });

    it("detects a collision from status, assignee or priority", () => {
      const shown = ticket("a", { assignedToUserId: "u1" });
      expect(changedElsewhere(shown, shown)).toBe(false);
      expect(changedElsewhere(shown, { ...shown, status: "RESOLVED" })).toBe(true);
      expect(changedElsewhere(shown, { ...shown, assignedToUserId: "u2" })).toBe(true);
      expect(changedElsewhere(shown, { ...shown, priority: "URGENT" })).toBe(true);
    });
  });
});
