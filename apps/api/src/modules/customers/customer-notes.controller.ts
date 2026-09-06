import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";
import type { CustomerNoteSummary } from "./customers.service";
import { CustomersService } from "./customers.service";

/**
 * RM-02 — mirrors `CustomerAttachmentsController`'s exact shape (a
 * dedicated `customers/:id/notes` controller, same module, same
 * permission choice): `customer:update` gates create, `customer:read`
 * gates list — no new permission, mirroring `TicketNote`'s own reuse of
 * `ticket:create`/`ticket:read`.
 */
@ApiTags("customers")
@ApiBearerAuth()
@Controller("customers/:id/notes")
export class CustomerNotesController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions("customer:update")
  create(
    @Param("id") customerId: string,
    @Body() dto: CreateCustomerNoteDto,
  ): Promise<CustomerNoteSummary> {
    return this.customersService.createCustomerNote(customerId, dto);
  }

  @Get()
  @RequirePermissions("customer:read")
  list(@Param("id") customerId: string): Promise<CustomerNoteSummary[]> {
    return this.customersService.listCustomerNotes(customerId);
  }
}
