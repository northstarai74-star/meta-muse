import { z } from "zod";
import { db } from "./db";
import {
  BUSINESS_LINES, CAMPAIGN_STATUS, CHANNELS, CLIENT_STATUS, CONTENT_STATUS, ORDER_STATUS, PRODUCT_STATUS,
} from "./constants";

const money = z.coerce.number().min(0, "Must be 0 or more").max(1e9);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const text = (max = 200) => z.string().trim().max(max);
const optText = (max = 200) =>
  z.union([text(max), z.null()]).optional().transform((v) => (v === undefined ? undefined : v || null));
/** Optional date: "" / null clear it, undefined leaves it alone (PATCH). */
const optDay = z
  .union([day, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v ? new Date(`${v}T00:00:00Z`) : null));
const reqDay = day.transform((v) => new Date(`${v}T00:00:00Z`));

type Delegate = {
  create(a: { data: unknown }): Promise<unknown>;
  update(a: { where: { id: string }; data: unknown }): Promise<unknown>;
  deleteMany(a: { where: { id: string } }): Promise<unknown>;
};

export type Resource = {
  delegate: Delegate;
  schema: z.ZodObject<z.ZodRawShape>;
  /** Only admins may touch this resource (finance data). */
  admin?: boolean;
};

export const RESOURCES: Record<string, Resource> = {
  products: {
    delegate: db.product as unknown as Delegate,
    schema: z.object({
      name: text().min(1, "Name the product"), sku: optText(60), supplier: optText(120), cost: money, price: money,
      stock: z.coerce.number().int().min(0).max(1e7), status: z.enum(PRODUCT_STATUS),
    }),
  },
  orders: {
    delegate: db.storeOrder as unknown as Delegate,
    schema: z.object({
      number: text(40).min(1, "Add an order number"), customer: text().min(1, "Add the customer"),
      productId: z.union([z.string(), z.null()]).optional().transform((v) => (v === undefined ? undefined : v || null)),
      productName: text().min(1, "Add the product"), quantity: z.coerce.number().int().min(1).max(100000),
      revenue: money, cost: money, status: z.enum(ORDER_STATUS), placedAt: reqDay,
    }),
  },
  campaigns: {
    delegate: db.campaign as unknown as Delegate,
    schema: z.object({
      name: text().min(1, "Name the campaign"), channel: z.enum(CHANNELS), service: z.enum([...BUSINESS_LINES.filter((l) => l !== "GENERAL"), "ALL"]),
      status: z.enum(CAMPAIGN_STATUS), budget: money, spend: money, leadsGenerated: z.coerce.number().int().min(0).max(1e8),
      startsAt: optDay, endsAt: optDay, notes: optText(1000),
    }),
  },
  content: {
    delegate: db.contentItem as unknown as Delegate,
    schema: z.object({
      title: text().min(1, "Give the post a title"), channel: z.enum(CHANNELS), status: z.enum(CONTENT_STATUS),
      scheduledFor: optDay, caption: optText(2000),
    }),
  },
  clients: {
    delegate: db.client as unknown as Delegate,
    schema: z.object({
      contactId: z.string().min(1, "Choose a contact"), service: z.enum(BUSINESS_LINES.filter((l) => l !== "GENERAL") as ["AI_VOICE", "WEB_DEV", "DROPSHIPPING"]),
      monthlyFee: money, status: z.enum(CLIENT_STATUS), startedAt: reqDay, renewsAt: optDay, notes: optText(1000),
    }),
  },
  finance: {
    admin: true,
    delegate: db.financeEntry as unknown as Delegate,
    schema: z.object({
      type: z.enum(["INCOME", "EXPENSE"]), category: text(60).min(1, "Pick a category"), amount: z.coerce.number().positive("Enter an amount").max(1e9),
      businessLine: z.enum(BUSINESS_LINES), note: optText(500), occurredAt: reqDay,
    }),
  },
  reserves: {
    admin: true,
    delegate: db.reserve as unknown as Delegate,
    schema: z.object({ name: text(80).min(1, "Name the reserve"), target: money }),
  },
};
