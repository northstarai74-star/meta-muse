import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  amount: z.coerce.number().positive("Enter an amount").max(1e9),
  direction: z.enum(["DEPOSIT", "WITHDRAW"]),
  note: z.string().trim().max(200).optional(),
});

/** Put money into / take money out of a reserve; every move is kept in the history. */
export const POST = route<Ctx>(
  async (req, { params }) => {
    const { id } = await params;
    const b = Body.parse(await req.json());
    const reserve = await db.reserve.findUnique({ where: { id } });
    if (!reserve) return json({ error: "Reserve not found" }, 404);
    const delta = b.direction === "DEPOSIT" ? b.amount : -b.amount;
    if (reserve.balance + delta < 0) return json({ error: "That's more than the reserve holds" }, 400);
    const [updated] = await db.$transaction([
      db.reserve.update({ where: { id }, data: { balance: { increment: delta } } }),
      db.reserveMove.create({ data: { reserveId: id, delta, note: b.note || null } }),
    ]);
    return json(updated);
  },
  { admin: true },
);
