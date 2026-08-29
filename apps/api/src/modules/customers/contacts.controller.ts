import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { SetContactPortalPasswordDto } from "./dto/set-contact-portal-password.dto";
import type { ContactSummary } from "./customers.service";
import { CustomersService } from "./customers.service";

/**
 * Contacts have no independent permission namespace — every route here
 * reuses `customer:*`, matching how a Contact has no lifecycle outside its
 * owning Customer. See docs/architecture/03-domain-boundaries.md.
 */
@ApiTags("customers")
@ApiBearerAuth()
@Controller("customers")
export class ContactsController {
  constructor(private readonly customersService: CustomersService) {}

  @Post(":id/contacts")
  @RequirePermissions("customer:create")
  create(@Param("id") customerId: string, @Body() dto: CreateContactDto): Promise<ContactSummary> {
    return this.customersService.createContact(customerId, dto);
  }

  @Get(":id/contacts")
  @RequirePermissions("customer:read")
  list(@Param("id") customerId: string): Promise<ContactSummary[]> {
    return this.customersService.listContacts(customerId);
  }

  @Patch(":id/contacts/:contactId")
  @RequirePermissions("customer:update")
  update(
    @Param("id") customerId: string,
    @Param("contactId") contactId: string,
    @Body() dto: UpdateContactDto,
  ): Promise<{ id: string }> {
    return this.customersService.updateContact(customerId, contactId, dto);
  }

  @Patch(":id/contacts/:contactId/portal-password")
  @RequirePermissions("customer:update")
  setPortalPassword(
    @Param("id") customerId: string,
    @Param("contactId") contactId: string,
    @Body() dto: SetContactPortalPasswordDto,
  ): Promise<{ id: string }> {
    return this.customersService.setContactPortalPassword(customerId, contactId, dto);
  }
}
