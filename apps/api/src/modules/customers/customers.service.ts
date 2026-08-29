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

const BCRYPT_ROUNDS = 12;

export interface CustomerSummary {
  id: string;
  displayName: string;
  isActive: boolean;
}

export interface ContactSummary {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
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

  async listCustomers(): Promise<CustomerSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customers = await this.prisma.customer.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
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

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findCustomerInScope(
    id: string,
  ): Promise<{ id: string; displayName: string; isActive: boolean; contacts: ContactSummary[] }> {
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
}): CustomerSummary {
  return { id: customer.id, displayName: customer.displayName, isActive: customer.isActive };
}

function toContactSummary(contact: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}): ContactSummary {
  return {
    id: contact.id,
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
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
