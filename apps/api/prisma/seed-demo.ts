// Story 215 (PR-3.0, decision PD-6) — the DEV-ONLY demo dataset.
//
// A realistic, self-contained branch ("Riyadh Support (Demo)") for product
// demos: agents, customers and contacts, a curated set of tickets in every
// status with SLA states relative to NOW (on track, at risk, breached, on
// hold), conversations that match their subjects, internal notes, history,
// CSAT responses, a bilingual knowledge base, quick replies and automation
// rules. The content lives in `demo-scenarios.ts`.
//
// Demo hardening — run it through `pnpm demo:reset` (repo root), which loads
// it into the isolated `crm_demo` database after a clean migrate + base seed,
// so automated-test leftovers never appear in a demo.
//
// Idempotent: every row has a deterministic id derived from a stable key and
// is upserted, so a re-run updates the same rows (and refreshes their
// timestamps relative to now, keeping the SLA examples meaningful) instead of
// duplicating them. It never touches other branches' data.
//
// Never runs in CI or production. Requires the base seed (roles) and
// DEMO_USER_PASSWORD — like the base seed, it refuses a hard-coded password:
//
//   DEMO_USER_PASSWORD=… pnpm --filter @crm/api prisma:seed:demo
import "reflect-metadata";
import { createHash } from "node:crypto";
import {
  AutomationActionAssignmentMode,
  ChannelMessageDirection,
  ChannelType,
  KbLocale,
  KnowledgeBaseArticleStatus,
  PrismaClient,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { hashPassword } from "../src/modules/identity/identity.service";
import {
  DEMO_ARTICLES,
  DEMO_CUSTOMERS,
  DEMO_KB_CATEGORIES,
  DEMO_QUICK_REPLIES,
  DEMO_SCENARIOS,
  type DemoCategory,
  type DemoScenario,
} from "./demo-scenarios";

const prisma = new PrismaClient();

const BRANCH_NAME = "Riyadh Support (Demo)";
const DEPARTMENT_NAME = "Customer Care";
const DEMO_EMAIL_DOMAIN = "demo.example";

/** A stable UUID (v5-shaped) for a demo key, so re-runs upsert the same rows. */
function demoId(key: string): string {
  const hex = createHash("sha1").update(`crm-demo:${key}`).digest("hex");
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const AGENTS = [
  { key: "sara", fullName: "Sara Al-Harbi" },
  { key: "omar", fullName: "Omar Haddad" },
  { key: "lina", fullName: "Lina Mansour" },
  { key: "daniel", fullName: "Daniel Brooks" },
  { key: "maya", fullName: "Maya Chen" },
];
const ADMIN = { key: "nadia", fullName: "Nadia Rahman" };

const CATEGORIES: DemoCategory[] = [
  "Billing",
  "Technical issue",
  "Account access",
  "Shipping & delivery",
  "Feature request",
];

/** SLA targets per priority, in minutes (response, resolution). */
const SLA_MINUTES: Record<TicketPriority, [number, number]> = {
  URGENT: [60, 480],
  HIGH: [180, 1440],
  MEDIUM: [480, 4320],
  LOW: [1440, 7200],
};

/**
 * The timeline of one scenario, relative to `now`: when it was created, when
 * the agent first replied (if they did), when it was resolved, and whether it
 * is on hold. Active tickets are placed on their SLA clock by `sla`; a reply
 * always lands inside the response target, so a "Response breached" ticket on
 * the board is exactly one nobody has answered yet.
 */
function timeline(scenario: DemoScenario, now: number, index: number) {
  const [response, resolution] = SLA_MINUTES[scenario.priority];
  const replied = scenario.messages.length > 1;
  // A small, stable per-ticket offset so tickets don't share a timestamp.
  const jitter = ((index * 7919) % 23) * MINUTE;
  let createdAt: number;
  let onHoldSince: Date | null = null;
  let resolvedAt: number | null = null;

  if (scenario.status === "OPEN" || scenario.status === "IN_PROGRESS") {
    switch (scenario.sla ?? "ok") {
      case "breach":
        createdAt = now - 1.35 * response * MINUTE - jitter;
        break;
      case "risk":
        createdAt = now - 0.85 * response * MINUTE;
        break;
      case "resRisk":
        createdAt = now - 0.88 * resolution * MINUTE;
        break;
      case "hold":
        createdAt = now - 0.5 * response * MINUTE;
        onHoldSince = new Date(now - 2 * HOUR);
        break;
      default:
        createdAt = now - (replied ? 0.3 * resolution : 0.25 * response) * MINUTE - jitter;
    }
  } else {
    createdAt = now - (scenario.daysAgo ?? 7) * DAY - jitter;
    const takes = scenario.lateResolution ? resolution * 1.6 : resolution * 0.35;
    resolvedAt = createdAt + takes * MINUTE;
  }
  const firstReplyAt = replied ? createdAt + Math.max(5, 0.4 * response) * MINUTE : null;
  return { createdAt, firstReplyAt, resolvedAt, onHoldSince, response, resolution };
}

async function main(): Promise<void> {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error(
      "DEMO_USER_PASSWORD must be set (at least 8 characters) — refusing to seed demo users with a default password.",
    );
  }
  const now = Date.now();

  const organization = await prisma.organization.findFirst();
  const agentRole = await prisma.role.findUnique({ where: { name: "Agent" } });
  const adminRole = await prisma.role.findUnique({ where: { name: "SuperAdmin" } });
  if (!organization || !agentRole || !adminRole) {
    throw new Error("Run the base seed first (pnpm --filter @crm/api prisma:seed).");
  }

  // Branch and department.
  const branch = await prisma.branch.upsert({
    where: { id: demoId("branch") },
    update: { name: BRANCH_NAME, isActive: true },
    create: {
      id: demoId("branch"),
      organizationId: organization.id,
      name: BRANCH_NAME,
      timezone: "Asia/Riyadh",
    },
  });
  const department = await prisma.department.upsert({
    where: { id: demoId("department") },
    update: { name: DEPARTMENT_NAME },
    create: { id: demoId("department"), branchId: branch.id, name: DEPARTMENT_NAME },
  });

  // People.
  const passwordHash = await hashPassword(password);
  const users = new Map<string, { id: string; fullName: string }>();
  for (const [person, role] of [
    [ADMIN, adminRole],
    ...AGENTS.map((agent) => [agent, agentRole] as const),
  ] as const) {
    const email = `${person.key}@${DEMO_EMAIL_DOMAIN}`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        fullName: person.fullName,
        isActive: true,
        activeBranchId: branch.id,
      },
      create: {
        id: demoId(`user:${person.key}`),
        email,
        passwordHash,
        fullName: person.fullName,
        activeBranchId: branch.id,
      },
    });
    await prisma.userBranchRole.upsert({
      where: { id: demoId(`membership:${person.key}`) },
      update: { roleId: role.id, departmentId: department.id },
      create: {
        id: demoId(`membership:${person.key}`),
        userId: user.id,
        branchId: branch.id,
        departmentId: department.id,
        roleId: role.id,
      },
    });
    users.set(person.key, user);
  }

  // Customers and contacts (the first contact of Desert Rose can sign in to the portal).
  const customers = new Map<string, { id: string; contacts: Array<{ id: string }> }>();
  for (const [customerIndex, customer] of DEMO_CUSTOMERS.entries()) {
    const since = new Date(now - customer.since * DAY - customerIndex * 37 * MINUTE);
    const row = await prisma.customer.upsert({
      where: { id: demoId(`customer:${customer.key}`) },
      update: { displayName: customer.name, isActive: true, createdAt: since },
      create: {
        id: demoId(`customer:${customer.key}`),
        branchId: branch.id,
        displayName: customer.name,
        createdAt: since,
      },
    });
    const contacts = [];
    for (const [index, [fullName, handle]] of customer.contacts.entries()) {
      const contact = await prisma.contact.upsert({
        where: { id: demoId(`contact:${customer.key}:${handle}`) },
        update: { fullName },
        create: {
          id: demoId(`contact:${customer.key}:${handle}`),
          customerId: row.id,
          fullName,
          email: `${handle}@${customer.key}.${DEMO_EMAIL_DOMAIN}`,
          phone: `+9665${String(10000000 + customerIndex * 97 + index).slice(0, 8)}`,
          isPrimary: index === 0,
          passwordHash: customer.key === "desert-rose" && index === 0 ? passwordHash : null,
          createdAt: since,
        },
      });
      contacts.push(contact);
    }
    customers.set(customer.key, { id: row.id, contacts });
  }

  // Categories and SLA policies (one per priority).
  const categories = new Map<string, string>();
  for (const name of CATEGORIES) {
    const category = await prisma.ticketCategory.upsert({
      where: { id: demoId(`category:${name}`) },
      update: { name, isActive: true },
      create: { id: demoId(`category:${name}`), branchId: branch.id, name },
    });
    categories.set(name, category.id);
  }
  const policies = new Map<TicketPriority, string>();
  for (const priority of Object.keys(SLA_MINUTES) as TicketPriority[]) {
    const [response, resolution] = SLA_MINUTES[priority];
    const policy = await prisma.slaPolicy.upsert({
      where: { id: demoId(`sla:${priority}`) },
      update: {
        responseTargetMinutes: response,
        resolutionTargetMinutes: resolution,
        isActive: true,
      },
      create: {
        id: demoId(`sla:${priority}`),
        branchId: branch.id,
        priority,
        responseTargetMinutes: response,
        resolutionTargetMinutes: resolution,
      },
    });
    policies.set(priority, policy.id);
  }

  // Tickets, one per scenario.
  const counts: Record<string, number> = {};
  for (const [index, scenario] of DEMO_SCENARIOS.entries()) {
    const key = `ticket:${index}`;
    const customer = customers.get(scenario.customer);
    if (!customer) throw new Error(`Unknown demo customer ${scenario.customer}`);
    const contact = customer.contacts[scenario.contact ?? 0]!;
    const assignee = scenario.agent ? users.get(scenario.agent)! : null;
    const priority = TicketPriority[scenario.priority];
    const status = TicketStatus[scenario.status];
    const { createdAt, firstReplyAt, resolvedAt, onHoldSince, response, resolution } = timeline(
      scenario,
      now,
      index,
    );
    const active = resolvedAt === null;
    const lastMessageAt = createdAt + Math.max(scenario.messages.length - 1, 0) * 40 * MINUTE;
    const updatedAt = active
      ? new Date(Math.min(Math.max(firstReplyAt ?? createdAt, lastMessageAt), now - MINUTE))
      : new Date(resolvedAt + (status === TicketStatus.CLOSED ? 6 * HOUR : 0));
    const ticketFields = {
      subject: scenario.subject,
      status,
      priority,
      categoryId: categories.get(scenario.category)!,
      assignedToUserId: assignee?.id ?? null,
      customerId: customer.id,
      contactId: contact.id,
      createdAt: new Date(createdAt),
      updatedAt,
      resolvedAt: resolvedAt === null ? null : new Date(resolvedAt),
    };
    const ticket = await prisma.ticket.upsert({
      where: { id: demoId(key) },
      update: ticketFields,
      create: {
        id: demoId(key),
        branchId: branch.id,
        departmentId: department.id,
        ...ticketFields,
      },
    });
    counts[status] = (counts[status] ?? 0) + 1;

    const targetFields = {
      slaPolicyId: policies.get(priority)!,
      responseTargetAt: new Date(createdAt + response * MINUTE),
      resolutionTargetAt: new Date(createdAt + resolution * MINUTE),
      onHoldSince,
    };
    await prisma.slaTicketTarget.upsert({
      where: { ticketId: ticket.id },
      update: targetFields,
      create: { id: demoId(`${key}:sla`), ticketId: ticket.id, ...targetFields },
    });

    // History: created, then each status change in order.
    const snapshot = {
      id: ticket.id,
      subject: scenario.subject,
      status: TicketStatus.OPEN,
      priority,
      customerId: customer.id,
    };
    await prisma.ticketHistoryEntry.upsert({
      where: { id: demoId(`${key}:history:created`) },
      update: { createdAt: new Date(createdAt), snapshot },
      create: {
        id: demoId(`${key}:history:created`),
        ticketId: ticket.id,
        eventType: "ticket.created",
        snapshot,
        createdAt: new Date(createdAt),
      },
    });
    if (status !== TicketStatus.OPEN && assignee) {
      const changes: Array<[string, TicketStatus, number]> = [
        ["progress", TicketStatus.IN_PROGRESS, firstReplyAt ?? createdAt + 10 * MINUTE],
      ];
      if (resolvedAt !== null) changes.push(["resolved", TicketStatus.RESOLVED, resolvedAt]);
      if (status === TicketStatus.CLOSED)
        changes.push(["closed", TicketStatus.CLOSED, resolvedAt! + 6 * HOUR]);
      for (const [step, toStatus, at] of changes) {
        const changeSnapshot = { ...snapshot, status: toStatus };
        await prisma.ticketHistoryEntry.upsert({
          where: { id: demoId(`${key}:history:${step}`) },
          update: { createdAt: new Date(at), snapshot: changeSnapshot, actorUserId: assignee.id },
          create: {
            id: demoId(`${key}:history:${step}`),
            ticketId: ticket.id,
            actorUserId: assignee.id,
            eventType: "ticket.updated",
            snapshot: changeSnapshot,
            createdAt: new Date(at),
          },
        });
      }
    }

    // The conversation: the customer opens, the agent replies within the
    // response target, the customer follows up.
    const channelType = [ChannelType.WEB_FORM, ChannelType.EMAIL, ChannelType.LIVE_CHAT][
      index % 3
    ]!;
    for (const [position, body] of scenario.messages.entries()) {
      const inbound = position % 2 === 0;
      const at =
        position === 0
          ? createdAt + MINUTE
          : position === 1
            ? firstReplyAt!
            : resolvedAt !== null
              ? resolvedAt - (scenario.messages.length - position) * 25 * MINUTE
              : firstReplyAt! + position * 30 * MINUTE;
      const message = {
        body,
        createdAt: new Date(Math.min(at, now - MINUTE)),
        direction: inbound ? ChannelMessageDirection.INBOUND : ChannelMessageDirection.OUTBOUND,
        senderContactId: inbound ? contact.id : null,
        senderUserId: inbound ? null : (assignee?.id ?? null),
      };
      await prisma.channelMessage.upsert({
        where: { id: demoId(`${key}:message:${position}`) },
        update: message,
        create: {
          id: demoId(`${key}:message:${position}`),
          ticketId: ticket.id,
          channelType,
          ...message,
        },
      });
    }

    if (scenario.note && assignee) {
      await prisma.ticketNote.upsert({
        where: { id: demoId(`${key}:note`) },
        update: {
          body: scenario.note,
          createdAt: new Date((firstReplyAt ?? createdAt) + 5 * MINUTE),
        },
        create: {
          id: demoId(`${key}:note`),
          ticketId: ticket.id,
          authorUserId: assignee.id,
          body: scenario.note,
          createdAt: new Date(Math.min((firstReplyAt ?? createdAt) + 5 * MINUTE, now - MINUTE)),
        },
      });
    }

    if (scenario.csat && resolvedAt !== null) {
      const [rating, comment] = scenario.csat;
      await prisma.ticketCsatResponse.upsert({
        where: { ticketId: ticket.id },
        update: { rating, comment },
        create: {
          id: demoId(`${key}:csat`),
          ticketId: ticket.id,
          submittedByContactId: contact.id,
          rating,
          comment,
          createdAt: new Date(resolvedAt + 2 * HOUR),
        },
      });
    }
  }

  // Quick replies agents can insert from the composer.
  for (const [index, [title, body]] of DEMO_QUICK_REPLIES.entries()) {
    await prisma.quickReply.upsert({
      where: { id: demoId(`quick-reply:${index}`) },
      update: { title, body, isActive: true },
      create: { id: demoId(`quick-reply:${index}`), branchId: branch.id, title, body },
    });
  }

  // Automation rules: billing goes to Omar; shipping is balanced across two agents.
  await prisma.automationRule.upsert({
    where: { id: demoId("automation:billing") },
    update: {},
    create: {
      id: demoId("automation:billing"),
      branchId: branch.id,
      name: "Billing questions go to Omar",
      conditionCategoryId: categories.get("Billing")!,
      actionAssignToUserId: users.get("omar")!.id,
      actionSetPriority: TicketPriority.MEDIUM,
    },
  });
  await prisma.automationRule.upsert({
    where: { id: demoId("automation:shipping") },
    update: {},
    create: {
      id: demoId("automation:shipping"),
      branchId: branch.id,
      name: "Shipping issues: least-loaded of Maya and Daniel",
      conditionCategoryId: categories.get("Shipping & delivery")!,
      actionAssignToUserId: users.get("maya")!.id,
      actionAssignmentMode: AutomationActionAssignmentMode.LEAST_LOADED,
      eligibleAgentPool: [users.get("maya")!.id, users.get("daniel")!.id],
    },
  });

  // A bilingual knowledge base in three categories.
  const kbCategories = new Map<string, string>();
  for (const [slug, name] of Object.entries(DEMO_KB_CATEGORIES)) {
    const category = await prisma.knowledgeBaseCategory.upsert({
      where: { id: demoId(`kb-category:${slug}`) },
      update: { name },
      create: { id: demoId(`kb-category:${slug}`), branchId: branch.id, name },
    });
    kbCategories.set(slug, category.id);
  }
  for (const [
    index,
    [slug, categorySlug, title, body, titleAr, bodyAr],
  ] of DEMO_ARTICLES.entries()) {
    const publishedAt = new Date(now - (40 - index * 4) * DAY);
    const article = await prisma.knowledgeBaseArticle.upsert({
      where: { id: demoId(`kb:${slug}`) },
      update: {
        title,
        body,
        categoryId: kbCategories.get(categorySlug)!,
        status: KnowledgeBaseArticleStatus.PUBLISHED,
      },
      create: {
        id: demoId(`kb:${slug}`),
        branchId: branch.id,
        categoryId: kbCategories.get(categorySlug)!,
        title,
        body,
        status: KnowledgeBaseArticleStatus.PUBLISHED,
        publishedAt,
      },
    });
    await prisma.knowledgeBaseArticleTranslation.upsert({
      where: { articleId_locale: { articleId: article.id, locale: KbLocale.AR } },
      update: { title: titleAr, body: bodyAr },
      create: { articleId: article.id, locale: KbLocale.AR, title: titleAr, body: bodyAr },
    });
  }

  console.log(
    [
      "Demo dataset ready:",
      `  branch:   ${branch.name} (${branch.id})`,
      `  agents:   ${AGENTS.map((agent) => `${agent.key}@${DEMO_EMAIL_DOMAIN}`).join(", ")}`,
      `  admin:    ${ADMIN.key}@${DEMO_EMAIL_DOMAIN}`,
      `  portal:   layla@desert-rose.${DEMO_EMAIL_DOMAIN}`,
      `  tickets:  ${Object.entries(counts)
        .map(([status, count]) => `${status} ${count}`)
        .join(", ")}`,
      "  password: the DEMO_USER_PASSWORD you passed in",
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
