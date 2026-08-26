import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateBusinessHoursCalendarDto } from "./dto/create-business-hours-calendar.dto";
import { UpdateBusinessHoursCalendarDto } from "./dto/update-business-hours-calendar.dto";
import { CreateBusinessHoursExceptionDto } from "./dto/create-business-hours-exception.dto";
import { UpdateBusinessHoursExceptionDto } from "./dto/update-business-hours-exception.dto";
import type {
  BusinessHoursCalendarSummary,
  BusinessHoursExceptionSummary,
} from "./business-hours-calendars.service";
import { BusinessHoursCalendarsService } from "./business-hours-calendars.service";

/**
 * One calendar per caller's branch (`TenantContext.requireBranchScope()`) —
 * unlike every other resource in this codebase, routes here take no `:id`
 * for the calendar itself, because there is nothing to disambiguate: the
 * branch alone identifies at most one row (Story 12's "Settled decisions").
 * Exceptions ARE an open-ended list (like `customers.Contact`), so they keep
 * an `:exceptionId` param. No DELETE route anywhere — matches the existing
 * convention across `CustomersController`/`ContactsController`/
 * `TicketsController`/`SlaPoliciesController` (none of them expose delete;
 * see Story 10's "no `sla:delete`" precedent).
 */
@ApiTags("business-hours-calendars")
@ApiBearerAuth()
@Controller("business-hours-calendars")
export class BusinessHoursCalendarsController {
  constructor(private readonly businessHoursCalendarsService: BusinessHoursCalendarsService) {}

  @Post()
  @RequirePermissions("sla:create")
  create(@Body() dto: CreateBusinessHoursCalendarDto): Promise<BusinessHoursCalendarSummary> {
    return this.businessHoursCalendarsService.createCalendar(dto);
  }

  @Get()
  @RequirePermissions("sla:read")
  getOne(): Promise<BusinessHoursCalendarSummary> {
    return this.businessHoursCalendarsService.getCalendar();
  }

  @Patch()
  @RequirePermissions("sla:update")
  update(@Body() dto: UpdateBusinessHoursCalendarDto): Promise<{ id: string }> {
    return this.businessHoursCalendarsService.updateCalendar(dto);
  }

  @Post("exceptions")
  @RequirePermissions("sla:create")
  createException(
    @Body() dto: CreateBusinessHoursExceptionDto,
  ): Promise<BusinessHoursExceptionSummary> {
    return this.businessHoursCalendarsService.createException(dto);
  }

  @Get("exceptions")
  @RequirePermissions("sla:read")
  listExceptions(): Promise<BusinessHoursExceptionSummary[]> {
    return this.businessHoursCalendarsService.listExceptions();
  }

  @Patch("exceptions/:exceptionId")
  @RequirePermissions("sla:update")
  updateException(
    @Param("exceptionId") exceptionId: string,
    @Body() dto: UpdateBusinessHoursExceptionDto,
  ): Promise<{ id: string }> {
    return this.businessHoursCalendarsService.updateException(exceptionId, dto);
  }
}
