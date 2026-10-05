import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// deterministic PRNG so the demo data is stable between seeds
let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400_000 - h * 3600_000);

const first = ["Ava", "Liam", "Noah", "Mia", "Zara", "Omar", "Priya", "Lucas", "Sofia", "Ethan", "Chloe", "Ravi", "Hana", "Diego", "Emma", "Kai", "Layla", "Marcus", "Nina", "Tariq"];
const last = ["Khan", "Patel", "Smith", "Garcia", "Nguyen", "Brown", "Ali", "Rossi", "Chen", "Walker", "Silva", "Moore", "Ahmed", "Lopez", "Kim"];
const companies = ["Bright Smile Dental", "Peak Fitness", "Urban Cuts Salon", "Nova Realty", "GreenLeaf Cafe", "Atlas Plumbing", "Luna Boutique", "Swift Auto Care", "Zen Spa", "Harbor Law", "PetPal Vets", "Orbit Gadgets"];

const MESSAGES: Record<string, string[]> = {
  AI_VOICE: [
    "Hi, we miss a lot of calls at our clinic. Can your AI receptionist book appointments for us?",
    "How much is the AI voice agent? We need someone to answer the phone after hours.",
    "Interested in an AI receptionist for our salon, can you call me?",
    "Do you integrate the voice agent with Google Calendar? We get tons of missed calls.",
  ],
  WEB_DEV: [
    "Need a new website for my restaurant, budget around $3k. Can you share your portfolio?",
    "Looking for a developer to redesign our landing page and improve SEO.",
    "Can you build a booking web app for my gym? How long would it take?",
    "Do you build Shopify themes? We want a custom redesign.",
  ],
  DROPSHIPPING: [
    "Do you have suppliers for fitness products? Looking to start a dropshipping store.",
    "Can you source a winning product and set up my store? What's the price?",
    "Interested in bulk order pricing for phone accessories, what's the MOQ?",
    "Need help with dropshipping product sourcing and fast shipping to the US.",
  ],
};
const SOURCES = ["META_DM", "META_DM", "META_DM", "META_COMMENT", "META_LEAD_AD", "META_LEAD_AD"] as const;
const SERVICE_VALUE: Record<string, number> = { AI_VOICE: 1500, WEB_DEV: 3000, DROPSHIPPING: 800 };

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@vanita.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

  // wipe demo data (keeps API keys + Meta connection + settings)
  await db.reserveMove.deleteMany();
  await db.reserve.deleteMany();
  await db.financeEntry.deleteMany();
  await db.client.deleteMany();
  await db.contentItem.deleteMany();
  await db.campaign.deleteMany();
  await db.storeOrder.deleteMany();
  await db.product.deleteMany();
  await db.activity.deleteMany();
  await db.deal.deleteMany();
  await db.enquiry.deleteMany();
  await db.comment.deleteMany();
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.lead.deleteMany();
  await db.contact.deleteMany();
  await db.assignmentRule.deleteMany();
  await db.user.deleteMany();

  const hash = await bcrypt.hash(password, 10);
  const admin = await db.user.create({ data: { name: "Vanita", email, passwordHash: hash, role: "ADMIN", title: "Founder", avatarColor: "#6366f1" } });
  const team = await Promise.all(
    [
      ["Aisha Rahman", "aisha@vanita.local", "Sales Lead", "#ec4899"],
      ["Daniel Cruz", "daniel@vanita.local", "Web Developer", "#3b82f6"],
      ["Meera Shah", "meera@vanita.local", "Dropshipping Manager", "#f59e0b"],
    ].map(([name, em, title, color]) =>
      db.user.create({ data: { name, email: em, passwordHash: hash, title, avatarColor: color } }),
    ),
  );
  const [aisha, daniel, meera] = team;

  await db.assignmentRule.createMany({
    data: [
      { service: "AI_VOICE", agent: "AI", userId: aisha.id },
      { service: "WEB_DEV", agent: "HUMAN", userId: daniel.id },
      { service: "DROPSHIPPING", agent: "AI", userId: meera.id },
    ],
  });

  const owners: Record<string, string> = { AI_VOICE: aisha.id, WEB_DEV: daniel.id, DROPSHIPPING: meera.id };
  const services = ["AI_VOICE", "WEB_DEV", "DROPSHIPPING"] as const;

  for (let i = 0; i < 64; i++) {
    const service = i < 6 ? "UNASSIGNED" : services[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2];
    const name = `${pick(first)} ${pick(last)}`;
    const handle = name.toLowerCase().replace(/\s/g, "_") + Math.floor(rnd() * 90 + 10);
    const source = pick(SOURCES);
    const age = Math.floor(88 * rnd() ** 1.5);
    const created = daysAgo(age, Math.floor(rnd() * 20));
    const text = service === "UNASSIGNED" ? "Hey! Love your content, what do you guys do exactly?" : pick(MESSAGES[service]);

    const contact = await db.contact.create({
      data: {
        name,
        instagramHandle: handle,
        igUserId: "ig_" + i,
        email: `${handle}@example.com`,
        phone: rnd() > 0.4 ? `+1 555 ${String(Math.floor(rnd() * 900 + 100))} ${String(Math.floor(rnd() * 9000 + 1000))}` : null,
        company: rnd() > 0.35 ? pick(companies) : null,
        source,
        createdAt: created,
      },
    });

    // older leads are more likely to be closed
    const r = rnd();
    const stage = service === "UNASSIGNED" ? "NEW" : age > 30 ? (r < 0.4 ? "WON" : r < 0.65 ? "LOST" : pick(["CONTACTED", "QUALIFIED", "PROPOSAL"])) : r < 0.2 ? "WON" : r < 0.3 ? "LOST" : pick(["NEW", "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"]);
    const value = service === "UNASSIGNED" ? 0 : Math.round((SERVICE_VALUE[service] * (0.6 + rnd() * 1.4)) / 50) * 50;

    const lead = await db.lead.create({
      data: {
        contactId: contact.id,
        title: text.length > 60 ? text.slice(0, 57) + "…" : text,
        source,
        service,
        stage,
        score: service === "UNASSIGNED" ? 20 : Math.floor(40 + rnd() * 58),
        aiSummary: text,
        assignedAgent: service === "AI_VOICE" || service === "DROPSHIPPING" ? (rnd() > 0.5 ? "AI" : "HUMAN") : "HUMAN",
        assignedUserId: service === "UNASSIGNED" ? null : owners[service],
        estimatedValue: value,
        createdAt: created,
      },
    });
    await db.activity.create({ data: { leadId: lead.id, type: "CREATED", text: "Lead captured from Meta", createdAt: created } });
    await db.activity.create({ data: { leadId: lead.id, type: "AI", text: `Claude classified as ${service.replace("_", " ")} and auto-assigned`, createdAt: new Date(created.getTime() + 60_000) } });

    if (stage === "WON") {
      const paidAt = new Date(Math.min(Date.now() - 3600_000, created.getTime() + (2 + Math.floor(rnd() * 12)) * 86400_000));
      await db.deal.create({ data: { leadId: lead.id, service, amount: value, status: "PAID", paidAt } });
      await db.activity.create({ data: { leadId: lead.id, type: "CONVERTED", text: `Converted — $${value} paid`, createdAt: paidAt } });
    }

    if (source === "META_DM") {
      const convo = await db.conversation.create({ data: { contactId: contact.id, externalId: "t_" + i, unread: rnd() > 0.7 ? 1 : 0, lastMessageAt: created } });
      await db.message.create({ data: { conversationId: convo.id, direction: "IN", text, sentAt: created } });
      if (stage !== "NEW") {
        const reply = "Thanks for reaching out! Happy to help — could you share a few more details so we can put together the right plan?";
        const t = new Date(created.getTime() + 15 * 60_000);
        await db.message.create({ data: { conversationId: convo.id, direction: "OUT", text: reply, sentAt: t } });
        await db.conversation.update({ where: { id: convo.id }, data: { lastMessageAt: t } });
      }
    } else if (source === "META_COMMENT") {
      await db.comment.create({ data: { contactId: contact.id, leadId: lead.id, author: handle, text, postRef: "post_" + (i % 5), handled: true, createdAt: created } });
    } else {
      await db.enquiry.create({ data: { leadId: lead.id, formName: "Free Consultation", name, email: contact.email, phone: contact.phone, message: text, handled: true, createdAt: created } });
    }
  }

  // Unhandled comments + enquiries waiting for triage
  const pending = [
    ["style.by.rina", "Price? Do you do voice AI for clinics? 👀"],
    ["mark_the_builder", "Love this site! Can you build one like it for my gym?"],
    ["shop_with_jay", "What's the MOQ on the phone cases in your last reel?"],
    ["dr.omar.dental", "interested!! DM sent"],
  ];
  for (const [i, [author, text]] of pending.entries()) {
    await db.comment.create({ data: { author, text, postRef: "reel_" + i, createdAt: daysAgo(0, i * 3 + 1) } });
  }
  await db.enquiry.createMany({
    data: [
      { formName: "Website Quote", name: "Carla Mendes", email: "carla@mendesdesign.com", phone: "+1 555 201 7788", message: "Need a portfolio site + booking system.", createdAt: daysAgo(0, 2) },
      { formName: "AI Receptionist Demo", name: "Dr. Samir Joshi", email: "samir@joshiortho.com", phone: "+1 555 902 1144", message: "Clinic misses ~20 calls/day. Want a demo.", createdAt: daysAgo(0, 6) },
    ],
  });

  // ---- Business sections (demo data) ----
  const products = await Promise.all(
    [
      ["Posture Corrector Pro", "PC-001", "Yiwu Direct", 6.4, 29.99, 140, "ACTIVE"],
      ["LED Sunset Lamp", "LL-014", "Shenzhen Glow Co", 4.1, 22.5, 3, "ACTIVE"],
      ["Magnetic Phone Case (iPhone)", "MC-220", "Yiwu Direct", 2.2, 14.99, 260, "ACTIVE"],
      ["Portable Blender Bottle", "BB-077", "Ningbo Home", 8.9, 39.0, 48, "ACTIVE"],
      ["Pet Hair Roller", "PH-031", "Ningbo Home", 1.8, 12.99, 4, "TESTING"],
      ["Yoga Mat Eco 6mm", "YM-009", "Guangzhou Fit", 7.5, 34.0, 0, "PAUSED"],
    ].map(([name, sku, supplier, cost, price, stock, status]) =>
      db.product.create({ data: { name: name as string, sku: sku as string, supplier: supplier as string, cost: cost as number, price: price as number, stock: stock as number, status: status as string } }),
    ),
  );
  const orderStatus = ["DELIVERED", "DELIVERED", "DELIVERED", "SHIPPED", "PENDING", "REFUNDED"] as const;
  for (let i = 0; i < 34; i++) {
    const p = pick(products.slice(0, 5));
    const qty = rnd() > 0.8 ? 2 : 1;
    const age = Math.floor(75 * rnd());
    const status = age > 14 ? pick(["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "REFUNDED"]) : pick(orderStatus);
    await db.storeOrder.create({
      data: {
        number: String(1001 + i), customer: `${pick(first)} ${pick(last)}`, productId: p.id, productName: p.name, quantity: qty,
        revenue: +(p.price * qty).toFixed(2), cost: +(p.cost * qty).toFixed(2), status, placedAt: daysAgo(age),
      },
    });
  }

  await db.campaign.createMany({
    data: [
      { name: "Reel: missed-calls clinic hook", channel: "INSTAGRAM", service: "AI_VOICE", status: "ACTIVE", budget: 600, spend: 412, leadsGenerated: 23, startsAt: daysAgo(18) },
      { name: "Lead ad: free website audit", channel: "META_ADS", service: "WEB_DEV", status: "ACTIVE", budget: 900, spend: 655, leadsGenerated: 31, startsAt: daysAgo(25) },
      { name: "TikTok: winning product tests", channel: "TIKTOK", service: "DROPSHIPPING", status: "ACTIVE", budget: 450, spend: 298, leadsGenerated: 0, startsAt: daysAgo(9), notes: "Store traffic campaign — judge by orders, not leads." },
      { name: "Newsletter: spring offer", channel: "EMAIL", service: "ALL", status: "DONE", budget: 80, spend: 80, leadsGenerated: 9, startsAt: daysAgo(40), endsAt: daysAgo(33) },
      { name: "YouTube explainer: AI receptionist", channel: "YOUTUBE", service: "AI_VOICE", status: "PLANNED", budget: 350, spend: 0, leadsGenerated: 0 },
    ],
  });
  const ahead = (d: number) => new Date(Date.now() + d * 86400_000);
  await db.contentItem.createMany({
    data: [
      { title: "Carousel: 5 calls your clinic is missing", channel: "INSTAGRAM", status: "SCHEDULED", scheduledFor: ahead(1), caption: "Every missed call is a missed patient…" },
      { title: "Reel: before/after website redesign", channel: "INSTAGRAM", status: "DRAFT", scheduledFor: ahead(3) },
      { title: "Story poll: which product should we test next?", channel: "INSTAGRAM", status: "IDEA" },
      { title: "TikTok: unboxing the sunset lamp", channel: "TIKTOK", status: "SCHEDULED", scheduledFor: ahead(2) },
      { title: "Case study: dental clinic +40% bookings", channel: "EMAIL", status: "IDEA" },
      { title: "Reel: how our AI books an appointment", channel: "INSTAGRAM", status: "POSTED", scheduledFor: daysAgo(4) },
    ],
  });

  const wonLeads = await db.lead.findMany({ where: { stage: "WON", service: { not: "UNASSIGNED" } }, take: 6, orderBy: { createdAt: "asc" } });
  const fees: Record<string, number> = { AI_VOICE: 499, WEB_DEV: 250, DROPSHIPPING: 350 };
  for (const [i, l] of wonLeads.entries()) {
    await db.client.create({
      data: {
        contactId: l.contactId, service: l.service, monthlyFee: fees[l.service], status: i === 4 ? "PAUSED" : i === 5 ? "CHURNED" : "ACTIVE",
        startedAt: daysAgo(30 + i * 20), renewsAt: i === 5 ? null : ahead(4 + i * 9),
        notes: i === 0 ? "Wants a monthly report on call volume." : null,
      },
    });
  }

  const income = [["Client payment", 1800, "AI_VOICE", "Clinic setup fee", 21], ["Retainer", 750, "WEB_DEV", "Site maintenance — Oct", 9], ["Other", 120, "GENERAL", "Affiliate payout", 15]] as const;
  for (const [category, amount, businessLine, note, age] of income) await db.financeEntry.create({ data: { type: "INCOME", category, amount, businessLine, note, occurredAt: daysAgo(age) } });
  const expense = [["Software & tools", 189, "GENERAL", "Hosting, CRM, voice minutes", 3], ["Contractors", 600, "WEB_DEV", "Freelance designer", 12], ["Software & tools", 79, "AI_VOICE", "Telephony platform", 8], ["Fees & taxes", 240, "GENERAL", "Payment processor fees", 20], ["Shipping", 160, "DROPSHIPPING", "Courier top-up", 6]] as const;
  for (const [category, amount, businessLine, note, age] of expense) await db.financeEntry.create({ data: { type: "EXPENSE", category, amount, businessLine, note, occurredAt: daysAgo(age) } });

  for (const [name, target, balance, moves] of [
    ["Tax (set aside 25%)", 4000, 1650, [[900, "Q3 profit"], [750, "Oct profit"]]],
    ["Emergency fund", 6000, 2400, [[2400, "Initial funding"]]],
    ["Ad budget buffer", 1500, 1500, [[1500, "Funded"]]],
  ] as const) {
    const r = await db.reserve.create({ data: { name, target, balance } });
    for (const [delta, note] of moves) await db.reserveMove.create({ data: { reserveId: r.id, delta, note } });
  }

  // MetaConnection placeholder so the webhook verify token exists
  await db.metaConnection.upsert({ where: { id: "singleton" }, create: { id: "singleton", verifyToken: "bos_verify_" + Math.random().toString(36).slice(2, 10) }, update: {} });
  await db.setting.upsert({ where: { key: "demoMode" }, create: { key: "demoMode", value: "true" }, update: {} });

  console.log(`Seeded. Admin login: ${admin.email} / ${password}`);
}

main().finally(() => db.$disconnect());
