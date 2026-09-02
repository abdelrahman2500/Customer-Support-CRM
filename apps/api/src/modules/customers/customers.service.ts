import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateCustomerDto } from "./dto/create-customer.dto";
import type { UpdateCustomerDto } from "./dto/update-customer.dto";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { UpdateContactDto } from "./dto/update-contact.dto";
import type { SetContactPortalPasswordDto } from "./dto/set-contact-portal-password.dto";
import type { ListCustomersQueryDto } from "./dto/list-customers-query.dto";

const BCRYPT_ROUNDS = 12;

/** Story 106 — mirrors `TicketsService`'s own `MAX_TICKET_ROWS` precedent
 * (Story 105): `Customer` is now this codebase's single largest
 * unbounded table (confirmed at 1182 rows in this session's dev
 * database, a comparable operational scale to `Ticket`), so the same
 * fixed cap applies at the same size. */
const MAX_CUSTOMER_ROWS = 500;

export interface CustomerSummary {
  id: string;
  displayName: string;
  isActive: boolean;
  /** Story 101 — exposed so `CustomerListView`'s new sortable "Created"
   * column has a real value to render, mirroring `TicketListItem.createdAt`. */
  createdAt: Date;
}

export interface ContactSummary {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  /** Story 100 — `passwordHash !== null`, the existing "no portal access"
   * semantic this model's own doc comment already establishes (Story 52).
   * Lets the frontend show a "Revoke" affordance only when there is
   * something to revoke. */
  hasPortalAccess: boolean;
}

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * Owns the `customers` schema — see docs/architecture/03-domain-boundaries.md
 * ("Customer Management"). `Customer` is the branch-scoped aggregate root;
 * `Contact` has no lifecycle or permission namespace of its own, so every
 * contact operation first confirms its parent `Customer` is inside the
 * caller's active branch via `requireCustomerInScope`.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createCustomer(dto: CreateCustomerDto): Promise<CustomerSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customer = await this.prisma.customer.create({
      data: { branchId, displayName: dto.displayName },
    });
    return toCustomerSummary(customer);
  }

  /**
   * Story 101 — `search`/`isActive`/`sortBy`/`sortDir` mirror
   * `TicketsService.listTickets`'s exact pattern (`ListTicketsQueryDto`/
   * `searchWhereClause`): `search` matches `displayName` via a plain
   * `contains`/`mode: "insensitive"` filter (never `Contact` fields, never
   * `tsvector` — see this story's own plan doc for why), `isActive` is an
   * equality filter, and omitting every param reproduces this method's
   * exact pre-Story-101 query/order byte-for-byte.
   */
  /** Story 106 — the DB fetch always requests `desc` on the chosen
   * `sortBy`, regardless of the caller's requested `sortDir`; a requested
   * `sortDir: "asc"` (the default) is restored by reversing the
   * already-fetched, already-capped array in memory. Mirrors
   * `TicketsService.listTickets`'s own identical fix (Story 105) and its
   * exact reasoning: capping a literal `sortDir: "asc"` query as-written
   * would fetch the *oldest* `MAX_CUSTOMER_ROWS` rows and, once a branch
   * exceeds the cap, freeze there forever — reversing a `desc`-fetched,
   * capped array reproduces the exact `asc` list a direct query would
   * have returned whenever the true row count is at or under the cap. */
  async listCustomers(query: ListCustomersQueryDto = {}): Promise<CustomerSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const sortBy = query.sortBy ?? "createdAt";
    const sortDir = query.sortDir ?? "asc";
    const customers = await this.prisma.customer.findMany({
      where: {
        branchId,
        ...(query.search
          ? { displayName: { contains: query.search, mode: "insensitive" } }
          : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive === "true" } : {}),
      },
      orderBy: { [sortBy]: "desc" },
      take: MAX_CUSTOMER_ROWS,
    });
    if (sortDir === "asc") {
      customers.reverse();
    }
    return customers.map(toCustomerSummary);
  }

  async getCustomer(id: string): Promise<CustomerSummary & { contacts: ContactSummary[] }> {
    const customer = await this.findCustomerInScope(id);
    return { ...toCustomerSummary(customer), contacts: customer.contacts.map(toContactSummary) };
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto): Promise<{ id: string }> {
    await this.requireCustomerInScope(id);
    await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return { id };
  }

  async listContacts(customerId: string): Promise<ContactSummary[]> {
    await this.requireCustomerInScope(customerId);
    const contacts = await this.prisma.contact.findMany({
      where: { customerId },
      orderBy: { createdAt: "asc" },
    });
    return contacts.map(toContactSummary);
  }

  async createContact(customerId: string, dto: CreateContactDto): Promise<ContactSummary> {
    await this.requireCustomerInScope(customerId);
    try {
      const contact = await this.prisma.contact.create({
        data: {
          customerId,
          fullName: dto.fullName,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          isPrimary: dto.isPrimary ?? false,
        },
      });
      return toContactSummary(contact);
    } catch (error) {
      throw translateDuplicateEmail(error);
    }
  }

  // ---------------------------------------------------------------------
  // Story 87 — Communication/Channels: Public Web-Form Ticket Intake
  // (no TenantContext; the caller has no branch session at all — mirrors
  // TicketsService's own "Story 53 — customer-scoped, no TenantContext"
  // precedent exactly).
  // ---------------------------------------------------------------------

  /**
   * Finds an existing Contact with this email under this branch (searched
   * across every Customer in the branch, since `Contact.email` is unique
   * only per-Customer, never globally — see this file's `Contact` model
   * doc comment in schema.prisma); creates a brand-new Customer + Contact
   * when none exists. `branchId` is a caller-supplied parameter, not
   * resolved from `TenantContext` — mirrors `TicketsService.
   * requireDepartmentInScope`'s/`IdentityService.updateBranch`'s own
   * existing precedent of a service reading another domain's `Branch` row
   * directly for a scope-existence check.
   */
  async findOrCreateContactForWebForm(
    branchId: string,
    input: { fullName: string; email: string; phone?: string },
  ): Promise<{ customerId: string; contactId: string }> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const existing = await this.prisma.contact.findFirst({
      where: { email: input.email, customer: { branchId } },
    });
    if (existing) {
      return { customerId: existing.customerId, contactId: existing.id };
    }

    const customer = await this.prisma.customer.create({
      data: { branchId, displayName: input.fullName },
    });
    const contact = await this.prisma.contact.create({
      data: {
        customerId: customer.id,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        isPrimary: true,
      },
    });
    return { customerId: customer.id, contactId: contact.id };
  }

  async updateContact(
    customerId: string,
    contactId: string,
    dto: UpdateContactDto,
  ): Promise<{ id: string }> {
    await this.requireCustomerInScope(customerId);
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }

    try {
      await this.prisma.contact.update({
        where: { id: contactId },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        },
      });
      return { id: contactId };
    } catch (error) {
      throw translateDuplicateEmail(error);
    }
  }

  /**
   * Story 52 — the only way a `Contact` gets Customer Portal access: an
   * agent explicitly sets a password for them (no self-registration, plan
   * Design item 6, mirrors `IdentityService.resetPassword`'s exact
   * "agent-driven, no forgot-password email" precedent). Requires the
   * contact to have an email on file (portal login is email-based) and
   * enforces, at write time, that no *other* contact already has portal
   * access with the same email — `Contact.email` is unique only per-Customer
   * (this model's own doc comment), so this is the invariant
   * `PortalService.login`'s lookup relies on being safe (plan Design item
   * 2). Revokes every existing `ContactRefreshToken` for this contact,
   * mirroring `resetPassword`'s own session-invalidation rule.
   */
  async setContactPortalPassword(
    customerId: string,
    contactId: string,
    dto: SetContactPortalPasswordDto,
  ): Promise<{ id: string }> {
    await this.requireCustomerInScope(customerId);
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }
    if (!existing.email) {
      throw new BadRequestException("This contact has no email on file — portal login requires one");
    }

    const duplicate = await this.prisma.contact.findFirst({
      where: { email: existing.email, passwordHash: { not: null }, id: { not: contactId } },
    });
    if (duplicate) {
      throw new ConflictException(
        "Another contact already has portal access with this email address",
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.contact.update({ where: { id: contactId }, data: { passwordHash } }),
      this.prisma.contactRefreshToken.updateMany({
        where: { contactId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { id: contactId };
  }

  /**
   * Story 100 — the inverse of `setContactPortalPassword`: clears portal
   * access rather than granting it. Mirrors its exact validate-then-
   * `$transaction` shape, minus the new-password/duplicate-email checks
   * that only apply when *granting* access. `passwordHash: null` is
   * already the established "no portal access" semantic (this model's own
   * doc comment, Story 52) — `PortalService.login`'s `passwordHash: {
   * not: null }` filter already rejects this contact with zero change to
   * that method. Revoking every live `ContactRefreshToken` mirrors
   * `setContactPortalPassword`'s own session-invalidation rule, so an
   * already-issued refresh token cannot outlive the revocation.
   */
  async revokeContactPortalAccess(customerId: string, contactId: string): Promise<{ id: string }> {
    await this.requireCustomerInScope(customerId);
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!existing) {
      throw new NotFoundException("Contact not found");
    }

    await this.prisma.$transaction([
      this.prisma.contact.update({ where: { id: contactId }, data: { passwordHash: null } }),
      this.prisma.contactRefreshToken.updateMany({
        where: { contactId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { id: contactId };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findCustomerInScope(id: string): Promise<{
    id: string;
    displayName: string;
    isActive: boolean;
    createdAt: Date;
    contacts: Array<{
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      isPrimary: boolean;
      passwordHash: string | null;
    }>;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customer = await this.prisma.customer.findFirst({
      where: { id, branchId },
      include: { contacts: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }

  private async requireCustomerInScope(id: string): Promise<void> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customer = await this.prisma.customer.findFirst({ where: { id, branchId } });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
  }
}

function toCustomerSummary(customer: {
  id: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
}): CustomerSummary {
  return {
    id: customer.id,
    displayName: customer.displayName,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
  };
}

function toContactSummary(contact: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  passwordHash: string | null;
}): ContactSummary {
  return {
    id: contact.id,
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
    hasPortalAccess: contact.passwordHash !== null,
  };
}

/**
 * A duplicate-email race that slips past the DB is caught here by Prisma's
 * `P2002` unique-constraint-violation code (backstopping the `@@unique([
 * customerId, email])` constraint) and turned into the same
 * `ConflictException` a non-racing duplicate would get — never a raw 500.
 * There is no application-level pre-check; the database constraint is the
 * single source of truth for this rule.
 */
function translateDuplicateEmail(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("A contact with this email already exists for this customer");
  }
  return error as Error;
}
