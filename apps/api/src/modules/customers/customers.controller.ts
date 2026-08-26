import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import type { ContactSummary, CustomerSummary } from "./customers.service";
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
  list(): Promise<CustomerSummary[]> {
    return this.customersService.listCustomers();
  }

  @Get(":id")
  @RequirePermissions("customer:read")
  getOne(@Param("id") id: string): Promise<CustomerSummary & { contacts: ContactSummary[] }> {
    return this.customersService.getCustomer(id);
  }

  @Patch(":id")
  @RequirePermissions("customer:update")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto): Promise<{ id: string }> {
    return this.customersService.updateCustomer(id, dto);
  }
}
