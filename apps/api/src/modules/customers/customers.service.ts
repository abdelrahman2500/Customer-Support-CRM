import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import type { Paginated } from "../../common/pagination/paginated";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateCustomerDto } from "./dto/create-customer.dto";
import type { UpdateCustomerDto } from "./dto/update-customer.dto";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { UpdateContactDto } from "./dto/update-contact.dto";
import type { SetContactPortalPasswordDto } from "./dto/set-contact-portal-password.dto";
import type { ListCustomersQueryDto } from "./dto/list-customers-query.dto";
import type { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";

const BCRYPT_ROUNDS = 12;

/**
 * Story S-8d — the shape a picker needs, and nothing else.
 *
 * Deliberately not `CustomerSummary`: a `<Select>` of customers needs an
 * id and a label, so sending `isActive`/`createdAt` for every row would be
 * payload the caller throws away.
 */
/**
 * Story 132 — the stable, non-identifying replacements written by
 * `anonymizeCustomer`. Deliberately NOT suffixed with the row's id, email
 * or any other per-record value: two anonymized customers should be
 * indistinguishable, and appending an identifier would re-introduce
 * exactly the kind of per-row signal the erasure exists to remove.
 */
const ANONYMIZED_CUSTOMER_NAME = "Anonymized customer";
const ANONYMIZED_CONTACT_NAME = "Anonymized contact";

export interface CustomerOption {
  id: string;
  displayName: string;
}

export interface CustomerSummary {
  id: string;
  displayName: string;
  isActive: boolean;
  /** Story 101 — exposed so `CustomerListView`'s new sortable "Created"
   * column has a real value to render, mirroring `TicketListItem.createdAt`. */
  createdAt: Date;
  /** Story 132 — `null` until an admin anonymizes this customer. The UI
   * reads it to render the anonymized state and withhold the action, and
   * it is the durable record that the erasure happened. */
  anonymizedAt: Date | null;
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

/** RM-02 — mirrors `TicketNoteSummary` exactly. */
export interface CustomerNoteSummary {
  id: string;
  customerId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
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
  /**
   * Story S-8d — a lookup for customer *pickers*, separate from the browsable
   * list.
   *
   * `CreateTicketView`'s customer `<Select>` was populated from
   * `GET /customers`, which is about to be paginated: a page of 25 would
   * make almost every customer unselectable, which is worse than the
   * current 500-row cap rather than better. A picker and a browsable table
   * are genuinely different reads — one needs *every* option to be
   * choosable, the other needs to be bounded — so they get different
   * endpoints instead of one compromise.
   *
   * Ordered by name because that is how a human scans a picker, unlike the
   * list's recency ordering. Same branch scope as every other read here;
   * inactive customers are included, matching what the picker showed
   * before, so no existing ticket-creation flow changes.
   */
  async listCustomerOptions(): Promise<CustomerOption[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customers = await this.prisma.customer.findMany({
      where: { branchId },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
    });
    return customers;
  }

  /**
   * Story S-8e — real pagination replaces the Story 106 row cap.
   *
   * Story 106 could not honour `sortDir: "asc"` directly: a capped
   * ascending query returns the *oldest* 500 rows and, once a branch
   * passes the cap, freezes there — every customer created afterwards
   * silently missing. It worked around that by always fetching `desc`
   * and reversing the array in memory, which reproduces the right list
   * only while the branch stays under the cap. With `skip`/`take` the
   * requested direction is simply the direction queried, so the
   * workaround and its caveat both go away, and rows past the old cap
   * become reachable rather than invisible.
   *
   * `id` is the ordering tiebreaker, following `sortDir` so the composite
   * order stays one consistent sequence. Neither `createdAt` nor
   * `displayName` is unique — bulk-seeded customers share a timestamp to
   * the millisecond, and two customers may genuinely share a name — and
   * offset paging over a non-unique sort repeats a row on one page while
   * dropping it from the next.
   */
  async listCustomers(query: ListCustomersQueryDto = {}): Promise<Paginated<CustomerSummary>> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const sortBy = query.sortBy ?? "createdAt";
    const sortDir = query.sortDir ?? "asc";
    const { items: customers, ...pagination } = await paginate(this.prisma.customer, {
      where: {
        branchId,
        ...(query.search ? { displayName: { contains: query.search, mode: "insensitive" } } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive === "true" } : {}),
      },
      orderBy: [{ [sortBy]: sortDir }, { id: sortDir }],
      page: query.page,
      pageSize: query.pageSize,
    });
    return { ...pagination, items: customers.map(toCustomerSummary) };
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
      throw new BadRequestException(
        "This contact has no email on file — portal login requires one",
      );
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

  /**
   * Story 132 — Customer Data Anonymization / Right-to-Erasure.
   *
   * Anonymizes in place; nothing is ever deleted. That is not a
   * preference, it is what the schema permits: `tickets.customer_id` is
   * `RESTRICT NOT NULL`, so a customer who has ever had a ticket — every
   * real customer — cannot be deleted at all, and six further relations
   * are `CASCADE`, so forcing it would silently destroy customer notes,
   * attachments, notification logs, portal preferences and whole AI chat
   * histories. Overwriting the structured identity fields instead keeps
   * ticket/SLA/reporting history complete and still attributable by id.
   *
   * SCOPE — this clears *structured identity data only*. Free-text bodies
   * (`ChannelMessage.body`, `ChatMessage.body`, `CustomerNote.body`,
   * `TicketCsatResponse.comment`), stored S3 objects, and the immutable
   * `admin.audit_logs` are deliberately RETAINED and documented as such.
   * Do not describe this operation as complete erasure.
   *
   * Mirrors `revokeContactPortalAccess` below: one `$transaction`, and
   * refresh tokens are *revoked* (`revokedAt` stamped) rather than
   * deleted, so the token trail survives.
   *
   * Idempotent: a repeat call is a success that changes nothing further,
   * and `anonymizedAt` is never re-stamped — the first erasure is the real
   * event.
   */
  async anonymizeCustomer(customerId: string): Promise<{ id: string; anonymizedAt: Date }> {
    await this.requireCustomerInScope(customerId);
    const existing = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, anonymizedAt: true },
    });
    if (!existing) {
      throw new NotFoundException("Customer not found");
    }

    // Already anonymized: the end state is already the desired one, so
    // this is a 200 no-op rather than a conflict. Returning the ORIGINAL
    // timestamp keeps the record of when the erasure actually happened.
    if (existing.anonymizedAt) {
      return { id: existing.id, anonymizedAt: existing.anonymizedAt };
    }

    const anonymizedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: customerId },
        data: {
          displayName: ANONYMIZED_CUSTOMER_NAME,
          isActive: false,
          anonymizedAt,
        },
      }),
      // `updateMany` covers zero contacts (affects 0 rows, no error) and
      // many contacts in one statement — no loop, no branching. `email` is
      // cleared to `null`, never to a placeholder string: the existing
      // `@@unique([customerId, email])` would reject a second contact
      // receiving the same placeholder, while PostgreSQL permits multiple
      // NULLs. Contacts already holding null email/phone or a null
      // passwordHash are simply re-set to the same value.
      this.prisma.contact.updateMany({
        where: { customerId },
        data: {
          fullName: ANONYMIZED_CONTACT_NAME,
          email: null,
          phone: null,
          preferredLocale: null,
          passwordHash: null,
          anonymizedAt,
        },
      }),
      this.prisma.contactRefreshToken.updateMany({
        where: { contact: { customerId }, revokedAt: null },
        data: { revokedAt: anonymizedAt },
      }),
    ]);

    return { id: customerId, anonymizedAt };
  }

  /** RM-02 — mirrors `TicketsService.getTicketNotes` exactly: oldest-first,
   * append-only, so the list itself is the note's own complete history —
   * no separate audit/history entry is written for a note, the same way
   * `TicketNote` creation writes no `TicketHistoryEntry` of its own. */
  async listCustomerNotes(customerId: string): Promise<CustomerNoteSummary[]> {
    await this.requireCustomerInScope(customerId);
    const notes = await this.prisma.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: "asc" },
    });
    return notes.map(toCustomerNoteSummary);
  }

  /** RM-02 — mirrors `TicketsService.createTicketNote` exactly. No domain
   * event is emitted: unlike `Ticket`, no agent-facing realtime room keyed
   * by `customerId` exists to relay one into, and creating one merely to
   * carry a single note-added event would be new event architecture this
   * story's own scope explicitly rules out. */
  async createCustomerNote(
    customerId: string,
    dto: CreateCustomerNoteDto,
  ): Promise<CustomerNoteSummary> {
    await this.requireCustomerInScope(customerId);
    const authorUserId = this.requireAuthenticatedUserId();

    const note = await this.prisma.customerNote.create({
      data: { customerId, authorUserId, body: dto.body },
    });
    return toCustomerNoteSummary(note);
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findCustomerInScope(id: string): Promise<{
    id: string;
    displayName: string;
    isActive: boolean;
    createdAt: Date;
    anonymizedAt: Date | null;
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

  /** RM-02 — mirrors `TicketsService.requireAuthenticatedUserId` exactly:
   * an author is never accepted from the caller, only ever resolved from
   * `TenantContext` (validated token claims). */
  private requireAuthenticatedUserId(): string {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no authenticated user on this request");
    }
    return userId;
  }
}

function toCustomerNoteSummary(note: {
  id: string;
  customerId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
}): CustomerNoteSummary {
  return {
    id: note.id,
    customerId: note.customerId,
    authorUserId: note.authorUserId,
    body: note.body,
    createdAt: note.createdAt,
  };
}

function toCustomerSummary(customer: {
  id: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  anonymizedAt: Date | null;
}): CustomerSummary {
  return {
    id: customer.id,
    displayName: customer.displayName,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    anonymizedAt: customer.anonymizedAt,
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
