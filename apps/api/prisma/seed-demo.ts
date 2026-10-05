// Story 215 (PR-3.0, decision PD-6) — the DEV-ONLY demo dataset.
//
// A realistic, self-contained branch ("Riyadh Support (Demo)") for product
// demos: agents, customers and contacts, ~120 tickets spread over every
// status, priority and category, SLA targets that land on-track / at-risk /
// breached / on-hold relative to NOW, conversations, internal notes, history,
// CSAT responses and a small bilingual knowledge base.
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
  ChannelMessageDirection,
  ChannelType,
  KbLocale,
  KnowledgeBaseArticleStatus,
  PrismaClient,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { hashPassword } from "../src/modules/identity/identity.service";

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

/** A small deterministic PRNG, so the dataset is the same on every run. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

const CUSTOMERS: Array<{ key: string; name: string; contacts: Array<[string, string]> }> = [
  {
    key: "desert-rose",
    name: "Desert Rose Hotels",
    contacts: [
      ["Layla Haddad", "layla"],
      ["Karim Nasser", "karim"],
    ],
  },
  { key: "nakheel", name: "Nakheel Logistics", contacts: [["Faisal Al-Otaibi", "faisal"]] },
  {
    key: "al-noor",
    name: "Al Noor Clinics",
    contacts: [
      ["Dr. Huda Salem", "huda"],
      ["Reem Qasim", "reem"],
    ],
  },
  { key: "bluewave", name: "Bluewave Telecom", contacts: [["James Carter", "james"]] },
  { key: "saffron", name: "Saffron Foods", contacts: [["Amira Youssef", "amira"]] },
  {
    key: "atlas",
    name: "Atlas Engineering",
    contacts: [
      ["Peter Lang", "peter"],
      ["Nour Fares", "nour"],
    ],
  },
  { key: "oasis", name: "Oasis Retail", contacts: [["Mona Saeed", "mona"]] },
  { key: "falcon", name: "Falcon Cargo", contacts: [["Yusuf Rahimi", "yusuf"]] },
  { key: "medina", name: "Medina Pharma", contacts: [["Hassan Ali", "hassan"]] },
  { key: "zahra", name: "Zahra Fashion", contacts: [["Zahra Karimi", "zahra"]] },
  {
    key: "cedar",
    name: "Cedar Bank",
    contacts: [
      ["Elias Haddad", "elias"],
      ["Rana Khoury", "rana"],
    ],
  },
  { key: "horizon", name: "Horizon Schools", contacts: [["Grace Miller", "grace"]] },
  { key: "lumen", name: "Lumen Energy", contacts: [["Tariq Aziz", "tariq"]] },
  { key: "qamar", name: "Qamar Travel", contacts: [["Salma Idris", "salma"]] },
];

const CATEGORIES = [
  "Billing",
  "Technical issue",
  "Account access",
  "Shipping & delivery",
  "Feature request",
];

const SUBJECTS: Record<string, string[]> = {
  Billing: [
    "Invoice for March shows the old plan price",
    "Charged twice for the annual renewal",
    "Need a VAT-compliant invoice copy",
    "Refund for the cancelled add-on",
    "تعديل بيانات الفاتورة الضريبية",
  ],
  "Technical issue": [
    "Dashboard keeps timing out after login",
    "Mobile app crashes when uploading photos",
    "Export to CSV produces an empty file",
    "Webhook deliveries failing since yesterday",
    "تعذر مزامنة البيانات مع النظام المحاسبي",
  ],
  "Account access": [
    "Can't log in after the password reset",
    "Two-factor code never arrives",
    "Add three new users to our workspace",
    "Former employee still has access",
    "طلب تفعيل حساب مستخدم جديد",
  ],
  "Shipping & delivery": [
    "Shipment stuck at customs for five days",
    "Wrong address on the delivery label",
    "Tracking link shows no updates",
    "Delivery arrived damaged — need a replacement",
    "تأخر وصول الشحنة إلى جدة",
  ],
  "Feature request": [
    "Arabic labels on printed receipts",
    "Bulk import for the product catalogue",
    "Calendar view for scheduled visits",
    "Single sign-on with our identity provider",
    "إضافة تقارير أسبوعية تلقائية",
  ],
};

const CUSTOMER_OPENERS = [
  "Hi team, we noticed this today and it is blocking our staff. Could you take a look?",
  "Hello, following up on this — it is affecting several of our locations.",
  "Good morning. This started after the last update. Screenshots are available if needed.",
  "مرحباً، نواجه هذه المشكلة منذ الأمس ونحتاج إلى حل سريع من فضلكم.",
];
const AGENT_REPLIES = [
  "Thanks for reaching out — I'm looking into this now and will update you within the hour.",
  "I've reproduced the issue and escalated it to our engineering team. I'll keep you posted.",
  "This should be fixed now. Could you confirm on your side?",
  "شكراً لتواصلكم، تم حل المشكلة. نرجو التأكيد من جهتكم.",
];
const CUSTOMER_FOLLOWUPS = [
  "Confirmed — it's working again. Thank you!",
  "Still seeing it on two devices, unfortunately.",
  "Thanks, appreciate the quick response.",
];
const NOTES = [
  "Customer is on the legacy plan — check pricing before quoting.",
  "Same root cause as last week's sync incident; linked in the runbook.",
  "Called the customer to confirm details. Waiting on their IT team.",
  "VIP account — keep the response under one hour.",
];

/** SLA targets per priority, in minutes (response, resolution). */
const SLA_MINUTES: Record<TicketPriority, [number, number]> = {
  URGENT: [60, 480],
  HIGH: [180, 1440],
  MEDIUM: [480, 4320],
  LOW: [1440, 7200],
};

async function main(): Promise<void> {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error(
      "DEMO_USER_PASSWORD must be set (at least 8 characters) — refusing to seed demo users with a default password.",
    );
  }
  const now = Date.now();
  const random = prng(20261005);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;

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
  const agentUsers = AGENTS.map((agent) => users.get(agent.key)!);

  // Customers and contacts (the first contact of Desert Rose can sign in to the portal).
  const customers: Array<{ id: string; contacts: Array<{ id: string; fullName: string }> }> = [];
  for (const customer of CUSTOMERS) {
    const row = await prisma.customer.upsert({
      where: { id: demoId(`customer:${customer.key}`) },
      update: { displayName: customer.name, isActive: true },
      create: {
        id: demoId(`customer:${customer.key}`),
        branchId: branch.id,
        displayName: customer.name,
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
          phone: `+9665${String(10000000 + customers.length * 97 + index).slice(0, 8)}`,
          isPrimary: index === 0,
          passwordHash: customer.key === "desert-rose" && index === 0 ? passwordHash : null,
        },
      });
      contacts.push(contact);
    }
    customers.push({ id: row.id, contacts });
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

  // Tickets.
  const STATUS_PLAN: Array<[TicketStatus, number]> = [
    [TicketStatus.OPEN, 36],
    [TicketStatus.IN_PROGRESS, 28],
    [TicketStatus.RESOLVED, 32],
    [TicketStatus.CLOSED, 24],
  ];
  let ticketIndex = 0;
  const counts: Record<string, number> = {};
  for (const [status, total] of STATUS_PLAN) {
    for (let n = 0; n < total; n += 1, ticketIndex += 1) {
      const key = `ticket:${ticketIndex}`;
      const roll = random();
      const priority =
        roll < 0.1
          ? TicketPriority.URGENT
          : roll < 0.35
            ? TicketPriority.HIGH
            : roll < 0.8
              ? TicketPriority.MEDIUM
              : TicketPriority.LOW;
      const categoryName = pick(CATEGORIES);
      const subject = pick(SUBJECTS[categoryName]!);
      const customer = pick(customers);
      const contact = pick(customer.contacts);
      const active = status === TicketStatus.OPEN || status === TicketStatus.IN_PROGRESS;
      const assignee = status === TicketStatus.OPEN && random() < 0.45 ? null : pick(agentUsers);
      const [responseMinutes, resolutionMinutes] = SLA_MINUTES[priority];

      // Where on its SLA clock an active ticket sits: mostly on track, some at
      // risk, a few breached, a few on hold. Measured on the response window,
      // the target the UI governs by (the earliest one).
      let createdAt: number;
      let onHoldSince: Date | null = null;
      if (active) {
        const slaRoll = random();
        const elapsedShare =
          slaRoll < 0.5
            ? 0.15 + random() * 0.4
            : slaRoll < 0.75
              ? 0.8 + random() * 0.15
              : slaRoll < 0.9
                ? 1.1 + random() * 0.8
                : 0.3 + random() * 0.3;
        createdAt = now - elapsedShare * responseMinutes * MINUTE;
        if (slaRoll >= 0.9) onHoldSince = new Date(now - (1 + random() * 3) * HOUR);
      } else {
        createdAt = now - (2 + random() * 18) * DAY;
      }
      const resolvedAt = active ? null : new Date(createdAt + (2 + random() * 30) * HOUR);
      const updatedAt = active
        ? new Date(createdAt + random() * (now - createdAt))
        : new Date(resolvedAt!.getTime() + (status === TicketStatus.CLOSED ? 6 * HOUR : 0));

      const ticket = await prisma.ticket.upsert({
        where: { id: demoId(key) },
        update: {
          subject,
          status,
          priority,
          categoryId: categories.get(categoryName)!,
          assignedToUserId: assignee?.id ?? null,
          customerId: customer.id,
          contactId: contact.id,
          createdAt: new Date(createdAt),
          updatedAt,
          resolvedAt,
        },
        create: {
          id: demoId(key),
          branchId: branch.id,
          departmentId: department.id,
          customerId: customer.id,
          contactId: contact.id,
          assignedToUserId: assignee?.id ?? null,
          subject,
          categoryId: categories.get(categoryName)!,
          priority,
          status,
          createdAt: new Date(createdAt),
          updatedAt,
          resolvedAt,
        },
      });
      counts[status] = (counts[status] ?? 0) + 1;

      await prisma.slaTicketTarget.upsert({
        where: { ticketId: ticket.id },
        update: {
          slaPolicyId: policies.get(priority)!,
          responseTargetAt: new Date(createdAt + responseMinutes * MINUTE),
          resolutionTargetAt: new Date(createdAt + resolutionMinutes * MINUTE),
          onHoldSince,
        },
        create: {
          id: demoId(`${key}:sla`),
          ticketId: ticket.id,
          slaPolicyId: policies.get(priority)!,
          responseTargetAt: new Date(createdAt + responseMinutes * MINUTE),
          resolutionTargetAt: new Date(createdAt + resolutionMinutes * MINUTE),
          onHoldSince,
        },
      });

      const snapshot = { id: ticket.id, subject, status, priority, customerId: customer.id };
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
        await prisma.ticketHistoryEntry.upsert({
          where: { id: demoId(`${key}:history:updated`) },
          update: { createdAt: updatedAt, snapshot, actorUserId: assignee.id },
          create: {
            id: demoId(`${key}:history:updated`),
            ticketId: ticket.id,
            actorUserId: assignee.id,
            eventType: "ticket.updated",
            snapshot,
            createdAt: updatedAt,
          },
        });
      }

      // A conversation for most tickets.
      if (random() < 0.8) {
        const channelType = pick([ChannelType.WEB_FORM, ChannelType.EMAIL, ChannelType.LIVE_CHAT]);
        const thread: Array<{ direction: ChannelMessageDirection; body: string; at: number }> = [
          {
            direction: ChannelMessageDirection.INBOUND,
            body: pick(CUSTOMER_OPENERS),
            at: createdAt + MINUTE,
          },
        ];
        if (assignee && status !== TicketStatus.OPEN) {
          thread.push({
            direction: ChannelMessageDirection.OUTBOUND,
            body: pick(AGENT_REPLIES),
            at: createdAt + (10 + random() * 50) * MINUTE,
          });
          if (!active) {
            thread.push({
              direction: ChannelMessageDirection.INBOUND,
              body: pick(CUSTOMER_FOLLOWUPS),
              at: (resolvedAt?.getTime() ?? now) - 30 * MINUTE,
            });
          }
        }
        for (const [index, message] of thread.entries()) {
          const inbound = message.direction === ChannelMessageDirection.INBOUND;
          await prisma.channelMessage.upsert({
            where: { id: demoId(`${key}:message:${index}`) },
            update: { body: message.body, createdAt: new Date(Math.min(message.at, now - MINUTE)) },
            create: {
              id: demoId(`${key}:message:${index}`),
              ticketId: ticket.id,
              channelType,
              direction: message.direction,
              senderContactId: inbound ? contact.id : null,
              senderUserId: inbound ? null : assignee!.id,
              body: message.body,
              createdAt: new Date(Math.min(message.at, now - MINUTE)),
            },
          });
        }
      }

      // Internal notes on some.
      if (assignee && random() < 0.35) {
        await prisma.ticketNote.upsert({
          where: { id: demoId(`${key}:note`) },
          update: { body: pick(NOTES), createdAt: new Date(createdAt + 20 * MINUTE) },
          create: {
            id: demoId(`${key}:note`),
            ticketId: ticket.id,
            authorUserId: assignee.id,
            body: pick(NOTES),
            createdAt: new Date(createdAt + 20 * MINUTE),
          },
        });
      }

      // CSAT for most resolved/closed tickets.
      if (!active && random() < 0.65) {
        const rating = random() < 0.12 ? 2 : random() < 0.3 ? 4 : 5;
        await prisma.ticketCsatResponse.upsert({
          where: { ticketId: ticket.id },
          update: { rating },
          create: {
            id: demoId(`${key}:csat`),
            ticketId: ticket.id,
            submittedByContactId: contact.id,
            rating,
            comment: rating >= 4 ? "Quick and helpful — thank you!" : "Took longer than we hoped.",
            createdAt: new Date(resolvedAt!.getTime() + 2 * HOUR),
          },
        });
      }
    }
  }

  // A small bilingual knowledge base.
  const kbCategory = await prisma.knowledgeBaseCategory.upsert({
    where: { id: demoId("kb-category:help") },
    update: { name: "Help centre" },
    create: { id: demoId("kb-category:help"), branchId: branch.id, name: "Help centre" },
  });
  const ARTICLES: Array<[string, string, string, string, string]> = [
    [
      "reset-password",
      "Resetting a user's password",
      "Ask a workspace administrator to open Users, choose the person and select Reset password. They receive a temporary password to sign in with.",
      "إعادة تعيين كلمة مرور المستخدم",
      "اطلب من مسؤول مساحة العمل فتح المستخدمين واختيار الشخص ثم إعادة تعيين كلمة المرور.",
    ],
    [
      "vat-invoice",
      "Downloading a VAT-compliant invoice",
      "Open Billing, select the invoice and choose Download PDF. Invoices include your VAT number once it is set in Account settings.",
      "تنزيل فاتورة ضريبية",
      "افتح الفوترة واختر الفاتورة ثم تنزيل PDF. تتضمن الفواتير رقمك الضريبي بعد إضافته في إعدادات الحساب.",
    ],
    [
      "track-shipment",
      "Tracking a shipment",
      "Every order has a tracking link in its confirmation email. Updates appear within two hours of each scan.",
      "تتبع الشحنة",
      "يحتوي كل طلب على رابط تتبع في بريد التأكيد. تظهر التحديثات خلال ساعتين من كل مسح.",
    ],
    [
      "export-csv",
      "Exporting reports to CSV",
      "Open Reports, set the date range and choose Export. Large exports are emailed when ready.",
      "تصدير التقارير بصيغة CSV",
      "افتح التقارير وحدد الفترة ثم اختر تصدير. تُرسل الملفات الكبيرة بالبريد عند جاهزيتها.",
    ],
  ];
  for (const [slug, title, body, titleAr, bodyAr] of ARTICLES) {
    const article = await prisma.knowledgeBaseArticle.upsert({
      where: { id: demoId(`kb:${slug}`) },
      update: { title, body, status: KnowledgeBaseArticleStatus.PUBLISHED },
      create: {
        id: demoId(`kb:${slug}`),
        branchId: branch.id,
        categoryId: kbCategory.id,
        title,
        body,
        status: KnowledgeBaseArticleStatus.PUBLISHED,
        publishedAt: new Date(now - 10 * DAY),
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
