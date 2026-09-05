import { describe, expect, it, vi } from "vitest";
import { paginate } from "./paginate";
import { totalPagesFor } from "./paginated";

/** A stand-in for a Prisma model delegate, recording what it was asked. */
function buildDelegate(total: number, rows: unknown[] = []) {
  return {
    count: vi.fn().mockResolvedValue(total),
    findMany: vi.fn().mockResolvedValue(rows),
  };
}

describe("totalPagesFor", () => {
  it("divides and rounds up", () => {
    expect(totalPagesFor(50, 25)).toBe(2);
    expect(totalPagesFor(51, 25)).toBe(3);
    expect(totalPagesFor(1, 25)).toBe(1);
  });

  it("floors at one page for an empty result", () => {
    // "Page 1 of 1" over an empty table reads correctly; "page 1 of 0"
    // does not, and every caller would have to special-case it.
    expect(totalPagesFor(0, 25)).toBe(1);
  });
});

describe("paginate", () => {
  it("defaults to the first page at the default page size", async () => {
    const delegate = buildDelegate(0);

    await paginate(delegate, { where: { branchId: "b1" }, orderBy: [{ id: "desc" }] });

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 25 }));
  });

  it("translates a page number into an offset", async () => {
    const delegate = buildDelegate(0);

    await paginate(delegate, {
      where: {},
      orderBy: [{ id: "desc" }],
      page: 4,
      pageSize: 10,
    });

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 30, take: 10 }));
  });

  it("returns the rows alongside accurate metadata", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    const delegate = buildDelegate(57, rows);

    const result = await paginate(delegate, {
      where: {},
      orderBy: [{ id: "desc" }],
      page: 2,
      pageSize: 25,
    });

    expect(result).toEqual({
      items: rows,
      total: 57,
      page: 2,
      pageSize: 25,
      totalPages: 3,
    });
  });

  it("passes the ordering through untouched", async () => {
    const delegate = buildDelegate(0);
    const orderBy = [{ createdAt: "desc" }, { id: "desc" }];

    await paginate(delegate, { where: {}, orderBy });

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy }));
  });

  /**
   * The reason this helper takes a delegate instead of two caller-supplied
   * promises. `total` is authorization-visible data: a count computed over
   * a wider `where` than the fetch would disclose how many rows exist that
   * the caller is not allowed to read. Passing one `where` in and issuing
   * both queries here makes that mistake unrepresentable.
   */
  it("issues both queries from the very same where object", async () => {
    const delegate = buildDelegate(0);
    const where = { OR: [{ branchId: "b1" }, { branchId: null }] };

    await paginate(delegate, { where, orderBy: [{ id: "desc" }] });

    expect(delegate.count).toHaveBeenCalledWith({ where });
    expect(delegate.count.mock.calls[0]![0]!.where).toBe(where);
    expect(delegate.findMany.mock.calls[0]![0]!.where).toBe(where);
  });

  it("returns an empty page past the end without losing the metadata", async () => {
    const delegate = buildDelegate(30, []);

    const result = await paginate(delegate, {
      where: {},
      orderBy: [{ id: "desc" }],
      page: 99,
      pageSize: 10,
    });

    // Past the end is a valid answer, not a 404: a client whose filter just
    // narrowed the result set gets enough information to correct itself.
    expect(result.items).toEqual([]);
    expect(result.total).toBe(30);
    expect(result.page).toBe(99);
    expect(result.totalPages).toBe(3);
  });

  it("counts once per call, not once per row", async () => {
    const delegate = buildDelegate(5, [{ id: "a" }]);

    await paginate(delegate, { where: {}, orderBy: [{ id: "desc" }] });

    expect(delegate.count).toHaveBeenCalledOnce();
    expect(delegate.findMany).toHaveBeenCalledOnce();
  });

  it("does not re-clamp a page size the DTO already validated", async () => {
    const delegate = buildDelegate(0);

    // Bounds belong to `PaginationQueryDto`, which rejects out-of-range
    // values with a 400 rather than silently shortening the response the
    // way the old `take: MAX_*_ROWS` caps did.
    await paginate(delegate, { where: {}, orderBy: [{ id: "desc" }], pageSize: 100 });

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });
});
