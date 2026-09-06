import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { TicketsModule } from "../tickets/tickets.module";
import { CustomersModule } from "../customers/customers.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

/**
 * RM-03 — Agent Tasks & Reminders. Owns the new `tasks` schema — see
 * `Task`'s own schema doc comment for why it has no `branchId`/
 * `departmentId` of its own. `TenantContext` is provided here the same
 * way every other feature module provides it. `TicketsModule`/
 * `CustomersModule` are imported so `TasksService` can inject their
 * already-exported `TicketsService`/`CustomersService` directly, mirroring
 * exactly how `TicketsModule` itself imports `CustomersModule` for
 * `WebFormIntakeService`'s own in-scope validation.
 */
@Module({
  imports: [TicketsModule, CustomersModule],
  controllers: [TasksController],
  providers: [TasksService, TenantContext],
})
export class TasksModule {}
