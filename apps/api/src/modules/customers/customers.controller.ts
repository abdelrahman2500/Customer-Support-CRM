import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type { Paginated } from "../../common/pagination/paginated";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers-query.dto";
import type { ContactSummary, CustomerSummary, CustomerOption } from "./customers.service";
import { CustomersService } from "./customers.service";

@ApiTags("customers")
@ApiBearerAuth()
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions("customer:create")
  create(@Body() dto: CreateCustomerDto): Promise<CustomerSummary> {
    return this.customersService.createCustomer(dto);
  }

  @Get()
  @RequirePermissions("customer:read")
  list(@Query() query: ListCustomersQueryDto): Promise<Paginated<CustomerSummary>> {
    return this.customersService.listCustomers(query);
  }

  /**
   * Story S-8d — declared before `@Get(":id")` so "options" is not captured
   * as a customer id. Same `customer:read` gate as the list: it exposes a
   * strict subset of the same rows.
   */
  @Get("options")
  @RequirePermissions("customer:read")
  listOptions(): Promise<CustomerOption[]> {
    return this.customersService.listCustomerOptions();
  }

  @Get(":id")
  @RequirePermissions("customer:read")
  getOne(@Param("id") id: string): Promise<CustomerSummary & { contacts: ContactSummary[] }> {
    return this.customersService.getCustomer(id);
  }

  /**
   * Story 132 — `POST`, not `DELETE`: nothing is deleted. A `DELETE` verb
   * would misdescribe the operation to every reader and API consumer, and
   * hard deletion is impossible here anyway (`tickets.customer_id` is
   * `RESTRICT NOT NULL`). No request body — the resource id is the whole
   * input.
   *
   * Guarded by its own `customer:anonymize`, never the `customer:update`
   * that agents already hold for routine edits. The API is the
   * authoritative boundary: the web UI does not gate on permissions (this
   * codebase has no client-side permission signal), so a caller without
   * the grant reaches this guard and receives a real 403.
   */
  @Post(":id/anonymize")
  @RequirePermissions("customer:anonymize")
  anonymize(@Param("id") id: string): Promise<{ id: string; anonymizedAt: Date }> {
    return this.customersService.anonymizeCustomer(id);
  }

  @Patch(":id")
  @RequirePermissions("customer:update")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto): Promise<{ id: string }> {
    return this.customersService.updateCustomer(id, dto);
  }
}
