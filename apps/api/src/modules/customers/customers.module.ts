import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ContactsController } from "./contacts.controller";
import { CustomerNotesController } from "./customer-notes.controller";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

/**
 * Owns the `customers` schema — see docs/architecture/03-domain-boundaries.md
 * ("Customer Management"). `TenantContext` is provided here the same way
 * `IdentityModule` provides it (see identity.module.ts) — it has no
 * dependencies beyond the ambient `REQUEST` token, so nothing stops it being
 * provided in more than one module.
 *
 * RM-02 — `CustomerNotesController` added the same way `CustomerAttachmentsController`
 * (a different module) already established for a `customers/:id/*`
 * sub-resource: its own controller file, same `CustomersService`.
 */
@Module({
  controllers: [CustomersController, ContactsController, CustomerNotesController],
  providers: [CustomersService, TenantContext],
  exports: [CustomersService],
})
export class CustomersModule {}
