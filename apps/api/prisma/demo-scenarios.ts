// The demo dataset's content: every ticket is a hand-written scenario, so no
// subject repeats and each conversation is about its own subject. Kept apart
// from `seed-demo.ts`, which only turns these rows into database records.

export type DemoCategory =
  "Billing" | "Technical issue" | "Account access" | "Shipping & delivery" | "Feature request";

/**
 * Where an active ticket sits on its SLA clock when the dataset is loaded.
 *
 * - `ok` — on track (replied in time when it has an agent reply).
 * - `risk` — no reply yet and the response target is close.
 * - `breach` — no reply and the response target has passed.
 * - `hold` — on hold (the clock is paused).
 * - `resRisk` — replied in time; the resolution target is close.
 */
export type DemoSla = "ok" | "risk" | "breach" | "hold" | "resRisk";

export interface DemoScenario {
  /** Customer key, and which of its contacts raised it (default 0). */
  customer: string;
  contact?: number;
  category: DemoCategory;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  /** Active tickets only. */
  sla?: DemoSla;
  /** Agent key; omitted = unassigned. */
  agent?: string;
  subject: string;
  /** Alternating customer / agent messages, starting with the customer. */
  messages: string[];
  note?: string;
  /** Resolved/closed tickets: created this many days ago. */
  daysAgo?: number;
  /** Resolved/closed tickets: resolved after the resolution target. */
  lateResolution?: boolean;
  csat?: [number, string];
}

export const DEMO_CUSTOMERS: Array<{
  key: string;
  name: string;
  /** How long ago the customer was added, in days. */
  since: number;
  contacts: Array<[string, string]>;
}> = [
  {
    key: "desert-rose",
    name: "Desert Rose Hotels",
    since: 412,
    contacts: [
      ["Layla Haddad", "layla"],
      ["Karim Nasser", "karim"],
    ],
  },
  {
    key: "nakheel",
    name: "Nakheel Logistics",
    since: 365,
    contacts: [["Faisal Al-Otaibi", "faisal"]],
  },
  {
    key: "al-noor",
    name: "Al Noor Clinics",
    since: 298,
    contacts: [
      ["Dr. Huda Salem", "huda"],
      ["Reem Qasim", "reem"],
    ],
  },
  { key: "bluewave", name: "Bluewave Telecom", since: 251, contacts: [["James Carter", "james"]] },
  { key: "saffron", name: "Saffron Foods", since: 220, contacts: [["Amira Youssef", "amira"]] },
  {
    key: "atlas",
    name: "Atlas Engineering",
    since: 187,
    contacts: [
      ["Peter Lang", "peter"],
      ["Nour Fares", "nour"],
    ],
  },
  { key: "oasis", name: "Oasis Retail", since: 160, contacts: [["Mona Saeed", "mona"]] },
  { key: "falcon", name: "Falcon Cargo", since: 131, contacts: [["Yusuf Rahimi", "yusuf"]] },
  { key: "medina", name: "Medina Pharma", since: 98, contacts: [["Hassan Ali", "hassan"]] },
  { key: "zahra", name: "Zahra Fashion", since: 74, contacts: [["Zahra Karimi", "zahra"]] },
  {
    key: "cedar",
    name: "Cedar Bank",
    since: 52,
    contacts: [
      ["Elias Haddad", "elias"],
      ["Rana Khoury", "rana"],
    ],
  },
  { key: "horizon", name: "Horizon Schools", since: 33, contacts: [["Grace Miller", "grace"]] },
  { key: "lumen", name: "Lumen Energy", since: 19, contacts: [["Tariq Aziz", "tariq"]] },
  { key: "qamar", name: "Qamar Travel", since: 8, contacts: [["Salma Idris", "salma"]] },
];

export const DEMO_SCENARIOS: DemoScenario[] = [
  // ── Open ────────────────────────────────────────────────────────────────
  {
    customer: "bluewave",
    category: "Technical issue",
    priority: "URGENT",
    status: "OPEN",
    sla: "breach",
    subject: "SMS alerts stopped reaching our field engineers",
    messages: [
      "Since 6 a.m. none of our engineers have received outage alerts by SMS. Email alerts still arrive. This is critical for us.",
    ],
  },
  {
    customer: "medina",
    category: "Account access",
    priority: "HIGH",
    status: "OPEN",
    sla: "breach",
    agent: "sara",
    subject: "Pharmacist accounts locked after password policy change",
    messages: [
      "After yesterday's policy change, all six pharmacists at the Olaya branch are locked out. They cannot dispense without signing in.",
    ],
  },
  {
    customer: "nakheel",
    category: "Shipping & delivery",
    priority: "HIGH",
    status: "OPEN",
    sla: "risk",
    agent: "sara",
    subject: "Container NKL-4471 held at Dammam port",
    messages: [
      "Our container NKL-4471 has been held at Dammam port for two days. Customs says a document is missing from your side. Which one?",
    ],
  },
  {
    customer: "desert-rose",
    category: "Technical issue",
    priority: "MEDIUM",
    status: "OPEN",
    sla: "ok",
    subject: "Guest Wi-Fi portal shows the old hotel logo",
    messages: [
      "The Wi-Fi sign-in page at the Corniche hotel still shows our logo from before the rebrand. Can it be updated before the weekend?",
    ],
  },
  {
    customer: "qamar",
    category: "Billing",
    priority: "MEDIUM",
    status: "OPEN",
    sla: "risk",
    subject: "فاتورة سبتمبر تتضمن رسوماً مكررة",
    messages: [
      "مرحباً، فاتورة شهر سبتمبر تحتوي على رسوم الحجز مرتين لنفس الرحلة. نرجو المراجعة وإصدار فاتورة معدلة.",
    ],
  },
  {
    customer: "oasis",
    category: "Feature request",
    priority: "LOW",
    status: "OPEN",
    sla: "ok",
    subject: "Loyalty points shown on printed receipts",
    messages: [
      "Our cashiers keep getting asked how many loyalty points a purchase earned. Could the points appear at the bottom of the printed receipt?",
    ],
  },
  {
    customer: "cedar",
    contact: 1,
    category: "Account access",
    priority: "URGENT",
    status: "OPEN",
    sla: "risk",
    agent: "omar",
    subject: "Former employee can still approve payments",
    messages: [
      "We removed Ahmad from the finance team on Sunday, but he could still approve a payment this morning. Please revoke his access immediately.",
    ],
  },
  {
    customer: "atlas",
    category: "Technical issue",
    priority: "MEDIUM",
    status: "OPEN",
    sla: "ok",
    agent: "lina",
    subject: "Project dashboard loads very slowly in the morning",
    messages: [
      "Between 8 and 9 a.m. the project dashboard takes almost a minute to load. Later in the day it is fine.",
    ],
  },
  {
    customer: "saffron",
    category: "Shipping & delivery",
    priority: "MEDIUM",
    status: "OPEN",
    sla: "breach",
    subject: "تأخر شحنة المكونات المبردة إلى جدة",
    messages: [
      "شحنة المكونات المبردة كان من المفترض أن تصل إلى فرع جدة أمس ولم تصل حتى الآن. نحتاج موعداً مؤكداً.",
    ],
  },
  {
    customer: "horizon",
    category: "Feature request",
    priority: "LOW",
    status: "OPEN",
    sla: "ok",
    agent: "daniel",
    subject: "Weekly attendance report by email",
    messages: [
      "Could principals receive a weekly attendance summary by email every Sunday morning instead of downloading it?",
    ],
  },
  {
    customer: "lumen",
    category: "Billing",
    priority: "HIGH",
    status: "OPEN",
    sla: "ok",
    subject: "Need a VAT invoice for the Q3 maintenance contract",
    messages: [
      "Our auditors need a VAT-compliant invoice for the Q3 maintenance contract by Thursday. The one we received has no VAT number.",
    ],
  },
  {
    customer: "falcon",
    category: "Shipping & delivery",
    priority: "LOW",
    status: "OPEN",
    sla: "hold",
    agent: "maya",
    subject: "Update the pickup address for the Riyadh warehouse",
    messages: [
      "We are moving the Riyadh warehouse on the 15th. Please update the pickup address once we confirm the new gate number.",
    ],
    note: "Waiting for the customer to confirm the new gate number — on hold until then.",
  },

  // ── In progress ─────────────────────────────────────────────────────────
  {
    customer: "desert-rose",
    category: "Billing",
    priority: "HIGH",
    status: "IN_PROGRESS",
    sla: "resRisk",
    agent: "sara",
    subject: "Charged twice for the annual renewal",
    messages: [
      "We were charged twice for our annual renewal on the 3rd — two identical transactions of SAR 18,400.",
      "Thanks Layla, I can see both transactions. I've asked our billing team to refund the duplicate and will confirm the reference today.",
    ],
    note: "Duplicate charge confirmed in the payment gateway. Refund request REF-2291 raised with finance.",
  },
  {
    customer: "al-noor",
    category: "Technical issue",
    priority: "URGENT",
    status: "IN_PROGRESS",
    sla: "ok",
    agent: "sara",
    subject: "Appointment reminders sent in the wrong language",
    messages: [
      "Patients who chose Arabic are receiving their appointment reminders in English since this morning.",
      "Thank you Dr. Huda — I've reproduced it and our team is rolling back this morning's template change now.",
    ],
  },
  {
    customer: "zahra",
    category: "Feature request",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    sla: "ok",
    agent: "sara",
    subject: "Size guide in Arabic on the product page",
    messages: [
      "Many of our customers read Arabic only. Can the size guide on product pages be translated?",
      "Great idea, Zahra. I've shared it with the product team and will send you a preview of the Arabic size guide this week.",
    ],
  },
  {
    customer: "medina",
    category: "Shipping & delivery",
    priority: "HIGH",
    status: "IN_PROGRESS",
    sla: "ok",
    agent: "omar",
    subject: "Temperature logger missing from the vaccine delivery",
    messages: [
      "Yesterday's vaccine delivery arrived without its temperature logger, so we cannot release the stock.",
      "Understood, Hassan. The courier confirms the logger is still in the van — it will be delivered to you before noon.",
    ],
  },
  {
    customer: "nakheel",
    category: "Billing",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    sla: "ok",
    agent: "lina",
    subject: "Fuel surcharge applied to a fixed-price contract",
    messages: [
      "Our contract is fixed-price, but the October invoice adds a fuel surcharge.",
      "You're right, Faisal — the surcharge shouldn't apply. I'm preparing a corrected invoice for your approval.",
    ],
  },
  {
    customer: "cedar",
    category: "Technical issue",
    priority: "HIGH",
    status: "IN_PROGRESS",
    sla: "resRisk",
    agent: "daniel",
    subject: "Statement export cuts off after 1,000 rows",
    messages: [
      "When we export a monthly statement to CSV, the file stops at exactly 1,000 rows.",
      "Thanks Elias — confirmed, the export has a hidden page limit. A fix is in testing; I'll send you the full file manually in the meantime.",
    ],
  },
  {
    customer: "atlas",
    contact: 1,
    category: "Account access",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    sla: "ok",
    agent: "maya",
    subject: "Single sign-on with Microsoft Entra ID",
    messages: [
      "We'd like our engineers to sign in with their Microsoft accounts.",
      "Happy to help, Nour. I've sent the SSO setup guide; once your IT team shares the tenant ID we'll enable it.",
    ],
  },
  {
    customer: "oasis",
    category: "Technical issue",
    priority: "LOW",
    status: "IN_PROGRESS",
    sla: "hold",
    agent: "omar",
    subject: "Barcode scanner beeps twice at the Riyadh Park store",
    messages: [
      "One of the scanners at Riyadh Park beeps twice and adds the item twice.",
      "Thanks Mona — we'll need the scanner's serial number to check its firmware. Could you send a photo of the label?",
    ],
    note: "On hold until the store sends the serial number.",
  },
  {
    customer: "qamar",
    category: "Account access",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    sla: "ok",
    agent: "lina",
    subject: "طلب صلاحيات لموظفي الحجوزات الجدد",
    messages: [
      "نحتاج إلى إنشاء حسابات لثلاثة موظفين جدد في قسم الحجوزات مع صلاحيات العرض فقط.",
      "أهلاً سلمى، تم إنشاء الحسابات الثلاثة وسيصلهم بريد التفعيل خلال دقائق.",
    ],
  },

  // ── Resolved ────────────────────────────────────────────────────────────
  {
    customer: "desert-rose",
    category: "Technical issue",
    priority: "HIGH",
    status: "RESOLVED",
    agent: "sara",
    daysAgo: 3,
    subject: "Booking engine timeouts during the Eid rush",
    messages: [
      "Guests are getting timeouts when booking rooms for Eid. It's our busiest week.",
      "We've added capacity to the booking engine and timeouts have stopped. Could you confirm on your side?",
      "Confirmed — bookings are going through again. Thank you for the fast fix!",
    ],
    csat: [5, "Fixed within the hour during our busiest week — thank you!"],
  },
  {
    customer: "bluewave",
    category: "Billing",
    priority: "MEDIUM",
    status: "RESOLVED",
    agent: "lina",
    daysAgo: 5,
    subject: "Credit note for the outage in August",
    messages: [
      "Our SLA entitles us to a credit for the outage on 12 August.",
      "Agreed, James — a credit note for SAR 4,200 has been issued and will appear on your next invoice.",
      "Received, thanks.",
    ],
    csat: [4, "Handled well."],
  },
  {
    customer: "saffron",
    category: "Account access",
    priority: "MEDIUM",
    status: "RESOLVED",
    agent: "omar",
    daysAgo: 6,
    subject: "إعادة تعيين كلمة مرور مدير الفرع",
    messages: [
      "مدير فرع الخبر لا يستطيع تسجيل الدخول بعد تغيير كلمة المرور.",
      "تمت إعادة تعيين كلمة المرور وإرسال رابط جديد إلى بريده الإلكتروني.",
      "تم الدخول بنجاح، شكراً لكم.",
    ],
    csat: [5, "خدمة سريعة وممتازة"],
  },
  {
    customer: "horizon",
    category: "Technical issue",
    priority: "HIGH",
    status: "RESOLVED",
    agent: "daniel",
    daysAgo: 8,
    lateResolution: true,
    subject: "Grades not syncing to the parent app",
    messages: [
      "Teachers entered term grades on Monday but parents still can't see them in the app.",
      "Found it — the nightly sync was failing on one class with a duplicate student ID. It's fixed and grades are visible now.",
      "Parents can see them now. It took a while, though.",
    ],
    csat: [3, "Fixed, but it took two days."],
  },
  {
    customer: "falcon",
    category: "Shipping & delivery",
    priority: "MEDIUM",
    status: "RESOLVED",
    agent: "maya",
    daysAgo: 4,
    subject: "Tracking link shows the wrong destination city",
    messages: [
      "The tracking link for shipment FC-88120 says Dammam, but it's going to Abha.",
      "Thanks Yusuf — the label was right, only the tracking page was wrong. It now shows Abha.",
    ],
  },
  {
    customer: "zahra",
    category: "Billing",
    priority: "LOW",
    status: "RESOLVED",
    agent: "sara",
    daysAgo: 9,
    subject: "Change the billing email to the finance team",
    messages: [
      "Please send invoices to finance@zahra.example instead of my personal email.",
      "Done — from next month all invoices go to finance@zahra.example.",
      "Perfect, thank you.",
    ],
    csat: [5, "Quick and simple."],
  },
  {
    customer: "lumen",
    category: "Technical issue",
    priority: "URGENT",
    status: "RESOLVED",
    agent: "omar",
    daysAgo: 2,
    subject: "Meter readings missing for the Yanbu site",
    messages: [
      "No meter readings have arrived from the Yanbu site since midnight.",
      "The site gateway lost its certificate after a reboot. We've renewed it and readings are flowing again, including the backlog.",
      "All readings are there. Thanks for jumping on it.",
    ],
    csat: [5, "Excellent response time."],
  },
  {
    customer: "cedar",
    category: "Feature request",
    priority: "LOW",
    status: "RESOLVED",
    agent: "lina",
    daysAgo: 12,
    subject: "Dark mode for the branch dashboard",
    messages: [
      "Our night-shift team would love a dark mode for the branch dashboard.",
      "Good news, Elias — dark mode is now available under Account → Theme.",
    ],
  },
  {
    customer: "al-noor",
    contact: 1,
    category: "Shipping & delivery",
    priority: "MEDIUM",
    status: "RESOLVED",
    agent: "daniel",
    daysAgo: 7,
    subject: "Medical supplies delivered to the wrong clinic",
    messages: [
      "The order for the Sulaimaniyah clinic was delivered to our Malaz clinic instead.",
      "Apologies, Reem. A courier collected it this morning and delivered it to Sulaimaniyah at 11:40.",
      "Received at the right clinic now, thank you.",
    ],
    csat: [4, "Sorted quickly after the mix-up."],
  },
  {
    customer: "desert-rose",
    contact: 1,
    category: "Feature request",
    priority: "LOW",
    status: "RESOLVED",
    agent: "maya",
    daysAgo: 14,
    subject: "Housekeeping status on the front-desk screen",
    messages: [
      "Could the front desk see which rooms housekeeping has finished, without calling them?",
      "That's now possible — enable the Housekeeping column under Front desk → View options.",
    ],
  },

  // ── Closed ──────────────────────────────────────────────────────────────
  {
    customer: "desert-rose",
    category: "Account access",
    priority: "MEDIUM",
    status: "CLOSED",
    agent: "omar",
    daysAgo: 21,
    subject: "Add the new night manager to the portal",
    messages: [
      "Please give our new night manager, Karim Nasser, access to the support portal.",
      "Done, Layla — Karim has been invited and can sign in with his work email.",
      "Thanks, he's in.",
    ],
    csat: [5, "Quick and helpful — thank you!"],
  },
  {
    customer: "nakheel",
    category: "Technical issue",
    priority: "HIGH",
    status: "CLOSED",
    agent: "daniel",
    daysAgo: 18,
    lateResolution: true,
    subject: "Driver app crashes when scanning delivery proofs",
    messages: [
      "The driver app closes whenever a driver scans a proof of delivery.",
      "We traced it to a camera library update. Version 4.2.1 with the fix is now in the app stores.",
      "Drivers updated and it's working.",
    ],
    csat: [2, "Our drivers were stuck for two days."],
  },
  {
    customer: "medina",
    category: "Billing",
    priority: "MEDIUM",
    status: "CLOSED",
    agent: "lina",
    daysAgo: 16,
    subject: "Purchase order number missing on invoices",
    messages: [
      "Our accounts team rejects invoices without the PO number.",
      "From now on the PO number from your order appears on every invoice. I've reissued last month's two invoices with it.",
    ],
    csat: [4, "Thanks for reissuing the old ones too."],
  },
  {
    customer: "oasis",
    category: "Shipping & delivery",
    priority: "LOW",
    status: "CLOSED",
    agent: "sara",
    daysAgo: 25,
    subject: "Schedule deliveries outside mall opening hours",
    messages: [
      "The mall only allows deliveries before 9 a.m. Can our deliveries be scheduled for 7–9 a.m.?",
      "All deliveries to your mall stores are now scheduled between 7 and 9 a.m.",
    ],
  },
  {
    customer: "atlas",
    category: "Billing",
    priority: "LOW",
    status: "CLOSED",
    agent: "maya",
    daysAgo: 30,
    subject: "Annual plan quote for 40 users",
    messages: [
      "We'd like a quote for the annual plan with 40 users.",
      "I've sent the quote to your inbox — it includes the 15% annual discount.",
      "Received, we'll go ahead. Thanks!",
    ],
    csat: [5, "Clear and fast."],
  },
  {
    customer: "qamar",
    category: "Technical issue",
    priority: "MEDIUM",
    status: "CLOSED",
    agent: "omar",
    daysAgo: 20,
    subject: "بطء في تحميل صفحة الحجوزات",
    messages: [
      "صفحة الحجوزات بطيئة جداً منذ يومين وتستغرق أكثر من ثلاثين ثانية.",
      "تم تحسين أداء قاعدة البيانات وأصبحت الصفحة تفتح خلال ثانيتين.",
      "ممتاز، أصبحت سريعة الآن.",
    ],
    csat: [5, "شكراً على المتابعة"],
  },
  {
    customer: "horizon",
    category: "Account access",
    priority: "MEDIUM",
    status: "CLOSED",
    agent: "lina",
    daysAgo: 27,
    subject: "Bulk-create accounts for the new term's teachers",
    messages: [
      "We have 35 new teachers starting this term. Can we create their accounts in bulk?",
      "Yes — I've enabled CSV import for your school. Upload the list under Users → Import.",
      "Imported all 35. Great feature.",
    ],
    csat: [5, "Saved us a full day."],
  },
  {
    customer: "zahra",
    category: "Shipping & delivery",
    priority: "HIGH",
    status: "CLOSED",
    agent: "daniel",
    daysAgo: 23,
    subject: "Return labels not printing for online orders",
    messages: [
      "Customers can't print return labels from their order page.",
      "The label service was rejecting long addresses. Fixed — labels print correctly now.",
    ],
    csat: [4, "Good fix."],
  },
];

/** Canned answers agents can insert from the composer. */
export const DEMO_QUICK_REPLIES: Array<[string, string]> = [
  [
    "Acknowledge and investigating",
    "Thank you for reaching out. I'm looking into this now and will update you within the hour.",
  ],
  [
    "Request a screenshot",
    "Could you send a screenshot of what you see, and the time it happened? It will help us find the cause quickly.",
  ],
  [
    "Confirm the fix",
    "We've applied a fix on our side. Could you check and confirm that everything works as expected now?",
  ],
  [
    "Refund in progress",
    "Your refund has been approved and will reach your account within 5–7 working days. You'll receive a confirmation email.",
  ],
  ["إقرار واستلام", "شكراً لتواصلكم. نعمل على طلبكم الآن وسنوافيكم بالتحديث خلال ساعة."],
  ["طلب لقطة شاشة", "هل يمكنكم إرسال لقطة شاشة للمشكلة مع وقت حدوثها؟ سيساعدنا ذلك في الحل بسرعة."],
];

/** Help-centre articles: [slug, category, title, body, arabic title, arabic body]. */
export const DEMO_ARTICLES: Array<
  [string, "help" | "billing" | "delivery", string, string, string, string]
> = [
  [
    "reset-password",
    "help",
    "Resetting a user's password",
    "If someone on your team can't sign in, a workspace administrator can reset their password.\n\n1. Open Admin → Users.\n2. Choose the person and select Edit.\n3. Under New password, enter a temporary password and select Reset password.\n\nThe person signs in with the temporary password and is asked to choose a new one. For security, every other session they had is signed out.",
    "إعادة تعيين كلمة مرور المستخدم",
    "إذا تعذر على أحد أعضاء فريقك تسجيل الدخول، يمكن لمسؤول مساحة العمل إعادة تعيين كلمة المرور.\n\n١. افتح الإدارة ← المستخدمون.\n٢. اختر الشخص ثم تعديل.\n٣. أدخل كلمة مرور مؤقتة ثم اختر إعادة تعيين كلمة المرور.\n\nيسجل المستخدم الدخول بكلمة المرور المؤقتة ثم يختار كلمة مرور جديدة.",
  ],
  [
    "two-factor",
    "help",
    "Setting up two-step verification",
    "Two-step verification protects your account even if your password is stolen.\n\nOpen Account → Security and choose Turn on. Scan the QR code with an authenticator app, then enter the six-digit code it shows. Keep the backup codes somewhere safe — each one works once if you lose your phone.",
    "إعداد التحقق بخطوتين",
    "يحمي التحقق بخطوتين حسابك حتى لو سُرقت كلمة المرور.\n\nافتح الحساب ← الأمان واختر تفعيل. امسح رمز QR بتطبيق المصادقة ثم أدخل الرمز المكون من ستة أرقام. احتفظ برموز الاسترداد في مكان آمن.",
  ],
  [
    "vat-invoice",
    "billing",
    "Downloading a VAT-compliant invoice",
    "Every invoice can be downloaded as a VAT-compliant PDF.\n\n1. Open Billing → Invoices.\n2. Select the invoice and choose Download PDF.\n\nInvoices show your VAT number once it is saved under Account → Company details. If an older invoice is missing it, ask us to reissue it — we'll send a corrected copy the same day.",
    "تنزيل فاتورة ضريبية",
    "يمكن تنزيل كل فاتورة بصيغة PDF متوافقة مع ضريبة القيمة المضافة.\n\n١. افتح الفوترة ← الفواتير.\n٢. اختر الفاتورة ثم تنزيل PDF.\n\nتظهر أرقامكم الضريبية بعد حفظها في الحساب ← بيانات الشركة.",
  ],
  [
    "refunds",
    "billing",
    "How refunds work",
    "Refunds go back to the original payment method.\n\nCard payments are refunded within 5–7 working days; bank transfers within 3 working days of approval. You'll receive an email with the refund reference as soon as it's approved. Duplicate charges are always refunded in full.",
    "كيف تتم عمليات الاسترداد",
    "تُعاد المبالغ إلى وسيلة الدفع الأصلية.\n\nيتم استرداد مدفوعات البطاقات خلال ٥ إلى ٧ أيام عمل، والتحويلات البنكية خلال ٣ أيام عمل من الموافقة. ستصلكم رسالة برقم مرجع الاسترداد.",
  ],
  [
    "change-billing-email",
    "billing",
    "Changing where invoices are sent",
    "Invoices are emailed to your billing contact. To send them to a shared finance mailbox instead, open Account → Billing contact, enter the new address and save. The change applies from the next invoice.",
    "تغيير البريد الذي تصل إليه الفواتير",
    "تُرسل الفواتير إلى جهة اتصال الفوترة. لتغييرها افتح الحساب ← جهة اتصال الفوترة وأدخل البريد الجديد ثم احفظ.",
  ],
  [
    "track-shipment",
    "delivery",
    "Tracking a shipment",
    "Every order confirmation email includes a tracking link. The tracking page updates within two hours of each scan — at pickup, at each hub and at delivery.\n\nIf a shipment hasn't moved for 48 hours, raise a ticket with the tracking number and we'll check with the carrier.",
    "تتبع الشحنة",
    "يحتوي كل بريد تأكيد طلب على رابط تتبع. تتحدث صفحة التتبع خلال ساعتين من كل مسح عند الاستلام وفي كل مركز وعند التسليم.\n\nإذا لم تتحرك الشحنة لمدة ٤٨ ساعة، افتح تذكرة برقم التتبع.",
  ],
  [
    "delivery-windows",
    "delivery",
    "Choosing a delivery window",
    "You can ask for deliveries to arrive within a fixed window, for example before a mall opens. Open Account → Delivery preferences, choose the store and set the window. Couriers receive the window with every order for that store.",
    "اختيار نافذة التسليم",
    "يمكنكم تحديد وقت ثابت للتسليم، مثل قبل افتتاح المركز التجاري. افتح الحساب ← تفضيلات التسليم، واختر المتجر وحدد النافذة.",
  ],
  [
    "damaged-delivery",
    "delivery",
    "What to do if a delivery arrives damaged",
    "Take photos of the package and the damaged items before unpacking further, then raise a ticket within 48 hours with the photos and the order number. We'll arrange a replacement or a refund — you don't need to return damaged items unless we ask.",
    "ماذا تفعل إذا وصلت الشحنة تالفة",
    "التقط صوراً للطرد والمنتجات التالفة، ثم افتح تذكرة خلال ٤٨ ساعة مع الصور ورقم الطلب. سنرتب بديلاً أو استرداداً.",
  ],
];

export const DEMO_KB_CATEGORIES: Record<"help" | "billing" | "delivery", string> = {
  help: "Account & security",
  billing: "Billing & payments",
  delivery: "Shipping & delivery",
};
