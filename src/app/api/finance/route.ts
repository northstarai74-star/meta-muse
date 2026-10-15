import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

const Body = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().positive("Amount must be more than 0").max(1e12),
  category: z.string().trim().min(1, "Pick or type a category").max(60),
  note: z.string().trim().max(300).optional(),
  date: z.string().optional(),
});

export const GET = route(async () => {
  const rows = await db.transaction.findMany({ orderBy: { date: "desc" }, take: 500 });
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const sum = (list: typeof rows, type: string) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const month = rows.filter((t) => t.date >= monthStart);
  const totals = (list: typeof rows) => {
    const income = sum(list, "INCOME");
    const expenses = sum(list, "EXPENSE");
    return { income, expenses, net: income - expenses };
  };
  return json({ transactions: rows, all: totals(rows), month: totals(month) });
});

export const POST = route(async (req) => {
  const b = Body.parse(await req.json());
  const t = await db.transaction.create({
    data: { type: b.type, amount: b.amount, category: b.category, note: b.note || null, date: b.date ? new Date(b.date) : new Date() },
  });
  return json(t, 201);
});
