import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BusinessHoursCalendarsService } from "./business-hours-calendars.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

/** Mimics the shape `PrismaClientKnownRequestError` exposes at `.code` — see
 * `customers.service.spec.ts`'s `buildUniqueConstraintError` precedent. */
function buildUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: "P2002",
    message: "Unique constraint failed",
  }) as Prisma.PrismaClientKnownRequestError;
}

function buildPrismaMock() {
  return {
    businessHoursCalendar: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    businessHoursDay: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    businessHoursException: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  };
}

function buildTenantContextMock(branchId: string | null = "branch-1") {
  return {
    requireBranchScope: vi.fn(() => {
      if (!branchId) {
        throw new Error("TenantContext: no active branch on this request");
      }
      return { branchId };
    }),
  };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
): BusinessHoursCalendarsService {
  return new BusinessHoursCalendarsService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

interface DayEntry {
  weekday: number;
  isOpen: boolean;
  startMinute?: number;
  endMinute?: number;
}

function fullWeekOpenDays(
  overrides: Partial<Record<number, Partial<Omit<DayEntry, "weekday">>>> = {},
): DayEntry[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const isWeekend = weekday === 0 || weekday === 6;
    const base: DayEntry = isWeekend
      ? { weekday, isOpen: false }
      : { weekday, isOpen: true, startMinute: 540, endMinute: 1020 };
    const override = overrides[weekday];
    return override ? { ...base, ...override } : base;
  });
}

describe("BusinessHoursCalendarsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: BusinessHoursCalendarsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createCalendar", () => {
    it("assigns branchId from TenantContext and creates 7 day rows", async () => {
      const days = fullWeekOpenDays();
      prisma.businessHoursCalendar.create.mockResolvedValue({
        id: "cal-1",
        days: days.map((d) => ({ ...d, startMinute: d.startMinute ?? null, endMinute: d.endMinute ?? null })),
        exceptions: [],
      });

      const result = await service.createCalendar({ days });

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.businessHoursCalendar.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: "branch-1" }) }),
      );
      expect(result.id).toBe("cal-1");
      expect(result.days).toHaveLength(7);
    });

    it("rejects when fewer than 7 day entries are given", async () => {
      const days = fullWeekOpenDays().slice(0, 6);

      await expect(service.createCalendar({ days })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.businessHoursCalendar.create).not.toHaveBeenCalled();
    });

    it("rejects a duplicate weekday entry", async () => {
      const days = fullWeekOpenDays();
      days[6] = { weekday: 0, isOpen: false }; // weekday 0 duplicated, weekday 6 missing

      await expect(service.createCalendar({ days })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an open day missing startMinute/endMinute", async () => {
      const days = fullWeekOpenDays({ 1: { startMinute: undefined, endMinute: undefined } });

      await expect(service.createCalendar({ days })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an open day where startMinute >= endMinute", async () => {
      const days = fullWeekOpenDays({ 1: { startMinute: 1000, endMinute: 500 } });

      await expect(service.createCalendar({ days })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a closed day that still carries startMinute/endMinute", async () => {
      const days = fullWeekOpenDays({ 0: { isOpen: false, startMinute: 540, endMinute: 1020 } });

      await expect(service.createCalendar({ days })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("translates a duplicate-branch unique-constraint violation into ConflictException", async () => {
      prisma.businessHoursCalendar.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(service.createCalendar({ days: fullWeekOpenDays() })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe("getCalendar", () => {
    it("throws NotFoundException when the caller's branch has no calendar", async () => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue(null);

      await expect(service.getCalendar()).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.businessHoursCalendar.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
    });

    it("returns the calendar with sorted days and mapped exceptions", async () => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({
        id: "cal-1",
        days: [
          { weekday: 2, isOpen: true, startMinute: 540, endMinute: 1020 },
          { weekday: 0, isOpen: false, startMinute: null, endMinute: null },
        ],
        exceptions: [
          {
            id: "exc-1",
            date: new Date("2026-12-25T00:00:00.000Z"),
            isClosed: true,
            overrideStartMinute: null,
            overrideEndMinute: null,
          },
        ],
      });

      const result = await service.getCalendar();

      expect(result.days.map((d) => d.weekday)).toEqual([0, 2]);
      expect(result.exceptions).toEqual([
        { id: "exc-1", date: "2026-12-25", isClosed: true, overrideStartMinute: null, overrideEndMinute: null },
      ]);
    });
  });

  describe("updateCalendar", () => {
    it("throws NotFoundException when the caller's branch has no calendar", async () => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue(null);

      await expect(service.updateCalendar({ days: fullWeekOpenDays() })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("replaces all 7 day rows in a transaction when days is provided", async () => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({ id: "cal-1", days: [], exceptions: [] });
      const days = fullWeekOpenDays();

      await service.updateCalendar({ days });

      expect(prisma.businessHoursDay.deleteMany).toHaveBeenCalledWith({ where: { calendarId: "cal-1" } });
      expect(prisma.businessHoursDay.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ calendarId: "cal-1", weekday: 0 })]),
        }),
      );
    });

    it("is a no-op on days when omitted", async () => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({ id: "cal-1", days: [], exceptions: [] });

      await service.updateCalendar({});

      expect(prisma.businessHoursDay.deleteMany).not.toHaveBeenCalled();
      expect(prisma.businessHoursDay.createMany).not.toHaveBeenCalled();
    });

    it("rejects invalid days without touching the database", async () => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({ id: "cal-1", days: [], exceptions: [] });
      const days = fullWeekOpenDays().slice(0, 6);

      await expect(service.updateCalendar({ days })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.businessHoursDay.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("listExceptions", () => {
    it("throws NotFoundException when the caller's branch has no calendar", async () => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue(null);

      await expect(service.listExceptions()).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lists exceptions scoped to the caller's calendar", async () => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({ id: "cal-1", days: [], exceptions: [] });
      prisma.businessHoursException.findMany.mockResolvedValue([]);

      await service.listExceptions();

      expect(prisma.businessHoursException.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { calendarId: "cal-1" } }),
      );
    });
  });

  describe("createException", () => {
    beforeEach(() => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({ id: "cal-1", days: [], exceptions: [] });
    });

    it("defaults isClosed to true and stores no override minutes", async () => {
      prisma.businessHoursException.create.mockResolvedValue({
        id: "exc-1",
        date: new Date("2026-12-25T00:00:00.000Z"),
        isClosed: true,
        overrideStartMinute: null,
        overrideEndMinute: null,
      });

      await service.createException({ date: "2026-12-25" });

      expect(prisma.businessHoursException.create).toHaveBeenCalledWith({
        data: {
          calendarId: "cal-1",
          date: new Date("2026-12-25"),
          isClosed: true,
          overrideStartMinute: null,
          overrideEndMinute: null,
        },
      });
    });

    it("rejects a closed exception that also carries override minutes", async () => {
      await expect(
        service.createException({ date: "2026-12-25", isClosed: true, overrideStartMinute: 0, overrideEndMinute: 100 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.businessHoursException.create).not.toHaveBeenCalled();
    });

    it("rejects an override exception missing one of the override minutes", async () => {
      await expect(
        service.createException({ date: "2026-12-25", isClosed: false, overrideStartMinute: 540 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an override exception where start >= end", async () => {
      await expect(
        service.createException({
          date: "2026-12-25",
          isClosed: false,
          overrideStartMinute: 1000,
          overrideEndMinute: 500,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("accepts a valid override exception", async () => {
      prisma.businessHoursException.create.mockResolvedValue({
        id: "exc-2",
        date: new Date("2026-12-31T00:00:00.000Z"),
        isClosed: false,
        overrideStartMinute: 540,
        overrideEndMinute: 720,
      });

      const result = await service.createException({
        date: "2026-12-31",
        isClosed: false,
        overrideStartMinute: 540,
        overrideEndMinute: 720,
      });

      expect(result).toEqual({
        id: "exc-2",
        date: "2026-12-31",
        isClosed: false,
        overrideStartMinute: 540,
        overrideEndMinute: 720,
      });
    });

    it("translates a duplicate-date unique-constraint violation into ConflictException", async () => {
      prisma.businessHoursException.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(service.createException({ date: "2026-12-25" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe("updateException", () => {
    beforeEach(() => {
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({ id: "cal-1", days: [], exceptions: [] });
    });

    it("throws NotFoundException for an unknown/out-of-scope exception id", async () => {
      prisma.businessHoursException.findFirst.mockResolvedValue(null);

      await expect(service.updateException("missing-id", {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.businessHoursException.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-id", calendarId: "cal-1" },
      });
    });

    it("validates the merged (existing + DTO) state, not the DTO in isolation", async () => {
      prisma.businessHoursException.findFirst.mockResolvedValue({
        id: "exc-1",
        isClosed: true,
        overrideStartMinute: null,
        overrideEndMinute: null,
      });

      // Switching to override hours without supplying both minutes must
      // still fail, using the *existing* (null) values merged in.
      await expect(
        service.updateException("exc-1", { isClosed: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.businessHoursException.update).not.toHaveBeenCalled();
    });

    it("allows switching from closed to a valid override in one update", async () => {
      prisma.businessHoursException.findFirst.mockResolvedValue({
        id: "exc-1",
        isClosed: true,
        overrideStartMinute: null,
        overrideEndMinute: null,
      });

      await service.updateException("exc-1", {
        isClosed: false,
        overrideStartMinute: 540,
        overrideEndMinute: 720,
      });

      expect(prisma.businessHoursException.update).toHaveBeenCalledWith({
        where: { id: "exc-1" },
        data: { isClosed: false, overrideStartMinute: 540, overrideEndMinute: 720 },
      });
    });

    it("clears override minutes when switching back to closed", async () => {
      prisma.businessHoursException.findFirst.mockResolvedValue({
        id: "exc-1",
        isClosed: false,
        overrideStartMinute: 540,
        overrideEndMinute: 720,
      });

      await service.updateException("exc-1", { isClosed: true });

      expect(prisma.businessHoursException.update).toHaveBeenCalledWith({
        where: { id: "exc-1" },
        data: { isClosed: true, overrideStartMinute: null, overrideEndMinute: null },
      });
    });
  });
});
