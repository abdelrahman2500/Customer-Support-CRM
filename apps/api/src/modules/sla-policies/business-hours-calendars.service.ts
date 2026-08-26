import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { BusinessHoursDayDto } from "./dto/business-hours-day.dto";
import type { CreateBusinessHoursCalendarDto } from "./dto/create-business-hours-calendar.dto";
import type { UpdateBusinessHoursCalendarDto } from "./dto/update-business-hours-calendar.dto";
import type { CreateBusinessHoursExceptionDto } from "./dto/create-business-hours-exception.dto";
import type { UpdateBusinessHoursExceptionDto } from "./dto/update-business-hours-exception.dto";

export interface BusinessHoursDaySummary {
  weekday: number;
  isOpen: boolean;
  startMinute: number | null;
  endMinute: number | null;
}

export interface BusinessHoursExceptionSummary {
  id: string;
  date: string;
  isClosed: boolean;
  overrideStartMinute: number | null;
  overrideEndMinute: number | null;
}

export interface BusinessHoursCalendarSummary {
  id: string;
  days: BusinessHoursDaySummary[];
  exceptions: BusinessHoursExceptionSummary[];
}

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";
const WEEKDAY_COUNT = 7;
const MAX_MINUTE_OF_DAY = 1439;

type DayRow = { weekday: number; isOpen: boolean; startMinute: number | null; endMinute: number | null };
type ExceptionRow = {
  id: string;
  date: Date;
  isClosed: boolean;
  overrideStartMinute: number | null;
  overrideEndMinute: number | null;
};

/**
 * Owns the `sla` schema's business-hours calendar foundation — see
 * docs/architecture/07-sla-automation-and-ai.md and Story 12's plan. One
 * calendar per Branch (`BusinessHoursCalendar.branchId` is `@unique`). Days
 * are always replaced wholesale (there are always exactly 7, never created/
 * removed individually); exceptions are an open-ended list managed the same
 * way `CustomersService` manages `Contact` under `Customer` (create/list/
 * update, no delete — see Story 12's "no DELETE endpoint anywhere in this
 * codebase" precedent).
 *
 * Does not compute or consume business hours — `SlaTargetListener` (Story
 * 11) is untouched and keeps using plain wall-clock arithmetic. This is
 * schema + CRUD only, exactly like `SlaPoliciesService` was for `SlaPolicy`
 * in Story 10.
 */
@Injectable()
export class BusinessHoursCalendarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createCalendar(dto: CreateBusinessHoursCalendarDto): Promise<BusinessHoursCalendarSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    validateDayEntries(dto.days);

    try {
      const calendar = await this.prisma.businessHoursCalendar.create({
        data: {
          branchId,
          days: { create: dto.days.map(toDayCreateInput) },
        },
        include: { days: true, exceptions: true },
      });
      return toCalendarSummary(calendar);
    } catch (error) {
      throw translateDuplicateCalendar(error);
    }
  }

  async getCalendar(): Promise<BusinessHoursCalendarSummary> {
    const calendar = await this.findCalendarInScope();
    return toCalendarSummary(calendar);
  }

  async updateCalendar(dto: UpdateBusinessHoursCalendarDto): Promise<{ id: string }> {
    const calendar = await this.findCalendarInScope();

    if (dto.days !== undefined) {
      validateDayEntries(dto.days);
      await this.prisma.$transaction([
        this.prisma.businessHoursDay.deleteMany({ where: { calendarId: calendar.id } }),
        this.prisma.businessHoursDay.createMany({
          data: dto.days.map((day) => ({ calendarId: calendar.id, ...toDayCreateInput(day) })),
        }),
      ]);
    }

    return { id: calendar.id };
  }

  async listExceptions(): Promise<BusinessHoursExceptionSummary[]> {
    const calendar = await this.findCalendarInScope();
    const exceptions = await this.prisma.businessHoursException.findMany({
      where: { calendarId: calendar.id },
      orderBy: { date: "asc" },
    });
    return exceptions.map(toExceptionSummary);
  }

  async createException(
    dto: CreateBusinessHoursExceptionDto,
  ): Promise<BusinessHoursExceptionSummary> {
    const calendar = await this.findCalendarInScope();
    const isClosed = dto.isClosed ?? true;
    validateExceptionFields({
      isClosed,
      overrideStartMinute: dto.overrideStartMinute,
      overrideEndMinute: dto.overrideEndMinute,
    });

    try {
      const exception = await this.prisma.businessHoursException.create({
        data: {
          calendarId: calendar.id,
          date: new Date(dto.date),
          isClosed,
          overrideStartMinute: isClosed ? null : dto.overrideStartMinute ?? null,
          overrideEndMinute: isClosed ? null : dto.overrideEndMinute ?? null,
        },
      });
      return toExceptionSummary(exception);
    } catch (error) {
      throw translateDuplicateException(error);
    }
  }

  async updateException(
    exceptionId: string,
    dto: UpdateBusinessHoursExceptionDto,
  ): Promise<{ id: string }> {
    const calendar = await this.findCalendarInScope();
    const existing = await this.prisma.businessHoursException.findFirst({
      where: { id: exceptionId, calendarId: calendar.id },
    });
    if (!existing) {
      throw new NotFoundException("Business-hours exception not found");
    }

    // When the *final* isClosed is true, override minutes are always
    // cleared — never carried forward from `existing` — regardless of
    // whether the DTO happened to also send override fields; only a final
    // isClosed:false pulls override minutes from the DTO or, failing that,
    // from what already existed.
    const isClosed = dto.isClosed !== undefined ? dto.isClosed : existing.isClosed;
    const merged = {
      isClosed,
      overrideStartMinute: isClosed
        ? undefined
        : dto.overrideStartMinute !== undefined
          ? dto.overrideStartMinute
          : existing.overrideStartMinute ?? undefined,
      overrideEndMinute: isClosed
        ? undefined
        : dto.overrideEndMinute !== undefined
          ? dto.overrideEndMinute
          : existing.overrideEndMinute ?? undefined,
    };
    validateExceptionFields({
      isClosed: merged.isClosed,
      overrideStartMinute: merged.overrideStartMinute ?? undefined,
      overrideEndMinute: merged.overrideEndMinute ?? undefined,
    });

    await this.prisma.businessHoursException.update({
      where: { id: exceptionId },
      data: {
        isClosed: merged.isClosed,
        overrideStartMinute: merged.isClosed ? null : merged.overrideStartMinute ?? null,
        overrideEndMinute: merged.isClosed ? null : merged.overrideEndMinute ?? null,
      },
    });
    return { id: exceptionId };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findCalendarInScope(): Promise<{
    id: string;
    days: DayRow[];
    exceptions: ExceptionRow[];
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const calendar = await this.prisma.businessHoursCalendar.findFirst({
      where: { branchId },
      include: { days: true, exceptions: true },
    });
    if (!calendar) {
      throw new NotFoundException("Business-hours calendar not found for this branch");
    }
    return calendar;
  }
}

function toDayCreateInput(day: BusinessHoursDayDto): {
  weekday: number;
  isOpen: boolean;
  startMinute: number | null;
  endMinute: number | null;
} {
  return {
    weekday: day.weekday,
    isOpen: day.isOpen,
    startMinute: day.isOpen ? day.startMinute ?? null : null,
    endMinute: day.isOpen ? day.endMinute ?? null : null,
  };
}

/**
 * Cross-field/cross-item validation for the 7-entry weekly schedule — not
 * expressible with per-field `class-validator` decorators alone. Mirrors
 * this codebase's existing split between DTO-level syntactic validation and
 * service-level business-rule validation (e.g. duplicate-email handling in
 * `CustomersService`).
 */
function validateDayEntries(days: BusinessHoursDayDto[]): void {
  if (days.length !== WEEKDAY_COUNT) {
    throw new BadRequestException(`Exactly ${WEEKDAY_COUNT} day entries are required (one per weekday)`);
  }

  const seenWeekdays = new Set<number>();
  for (const day of days) {
    if (seenWeekdays.has(day.weekday)) {
      throw new BadRequestException(`Duplicate weekday entry: ${day.weekday}`);
    }
    seenWeekdays.add(day.weekday);

    if (day.isOpen) {
      if (day.startMinute === undefined || day.endMinute === undefined) {
        throw new BadRequestException(
          `Weekday ${day.weekday} is open but is missing startMinute/endMinute`,
        );
      }
      if (day.startMinute >= day.endMinute) {
        throw new BadRequestException(
          `Weekday ${day.weekday}: startMinute must be before endMinute (overnight intervals are not supported)`,
        );
      }
    } else if (day.startMinute !== undefined || day.endMinute !== undefined) {
      throw new BadRequestException(
        `Weekday ${day.weekday} is closed but has startMinute/endMinute set`,
      );
    }
  }

  for (let weekday = 0; weekday < WEEKDAY_COUNT; weekday += 1) {
    if (!seenWeekdays.has(weekday)) {
      throw new BadRequestException(`Missing day entry for weekday ${weekday}`);
    }
  }
}

function validateExceptionFields(fields: {
  isClosed: boolean;
  overrideStartMinute?: number;
  overrideEndMinute?: number;
}): void {
  if (fields.isClosed) {
    if (fields.overrideStartMinute !== undefined || fields.overrideEndMinute !== undefined) {
      throw new BadRequestException("A closed exception cannot carry override hours");
    }
    return;
  }

  if (fields.overrideStartMinute === undefined || fields.overrideEndMinute === undefined) {
    throw new BadRequestException(
      "An overridden-hours exception requires overrideStartMinute and overrideEndMinute",
    );
  }
  if (fields.overrideStartMinute >= fields.overrideEndMinute) {
    throw new BadRequestException(
      "overrideStartMinute must be before overrideEndMinute (overnight intervals are not supported)",
    );
  }
  if (fields.overrideStartMinute < 0 || fields.overrideEndMinute > MAX_MINUTE_OF_DAY) {
    throw new BadRequestException("Override minutes must be within a single day (0-1439)");
  }
}

function toCalendarSummary(calendar: {
  id: string;
  days: DayRow[];
  exceptions: ExceptionRow[];
}): BusinessHoursCalendarSummary {
  return {
    id: calendar.id,
    days: calendar.days
      .slice()
      .sort((a, b) => a.weekday - b.weekday)
      .map((day) => ({
        weekday: day.weekday,
        isOpen: day.isOpen,
        startMinute: day.startMinute,
        endMinute: day.endMinute,
      })),
    exceptions: calendar.exceptions.map(toExceptionSummary),
  };
}

function toExceptionSummary(exception: ExceptionRow): BusinessHoursExceptionSummary {
  return {
    id: exception.id,
    date: exception.date.toISOString().slice(0, 10),
    isClosed: exception.isClosed,
    overrideStartMinute: exception.overrideStartMinute,
    overrideEndMinute: exception.overrideEndMinute,
  };
}

function translateDuplicateCalendar(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("A business-hours calendar already exists for this branch");
  }
  return error as Error;
}

function translateDuplicateException(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("An exception already exists for this date");
  }
  return error as Error;
}
