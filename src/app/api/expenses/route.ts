import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { CURRENCIES } from "@/lib/currency";

const Body = z.object({
  category: z.enum(Object.keys(EXPENSE_CATEGORIES) as [string, ...string[]]),
  description: z.string().trim().max(200).optional(),
  amount: z.number().positive("Enter the amount spent"),
  currency: z.enum(CURRENCIES).default("INR"),
  service: z.enum(["GENERAL", "AI_VOICE", "WEB_DEV", "DROPSHIPPING"]).default("GENERAL"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const POST = route(
  async (req) => {
    const b = Body.parse(await req.json());
    const incurredAt = b.date ? new Date(`${b.date}T12:00:00Z`) : new Date();
    if (Number.isNaN(incurredAt.getTime())) return json({ error: "Pick a valid date" }, 400);
    const e = await db.expense.create({
      data: { category: b.category, description: b.description || null, amount: b.amount, currency: b.currency, service: b.service, incurredAt },
    });
    return json(e, 201);
  },
  { admin: true },
);
