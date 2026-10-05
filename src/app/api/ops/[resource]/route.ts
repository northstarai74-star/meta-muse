import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { RESOURCES } from "@/lib/resources";

type Ctx = { params: Promise<{ resource: string }> };

export const POST = route<Ctx>(async (req, { params }, user) => {
  const { resource } = await params;
  const r = RESOURCES[resource];
  if (!r) return json({ error: "Unknown resource" }, 404);
  if (r.admin && user.role !== "ADMIN") return json({ error: "Admins only" }, 403);
  const data = r.schema.parse(await req.json()) as Record<string, unknown>;

  if (resource === "clients") {
    if (!(await db.contact.findUnique({ where: { id: data.contactId as string }, select: { id: true } }))) return json({ error: "Contact not found" }, 400);
  }

  if (resource === "orders") {
    const pid = data.productId as string | null | undefined;
    if (pid) {
      const p = await db.product.findUnique({ where: { id: pid } });
      if (!p) return json({ error: "Product not found" }, 400);
      const qty = data.quantity as number;
      const created = await db.$transaction([
        db.storeOrder.create({ data: data as never }),
        // Placing an order takes the units out of stock (never below zero)
        ...(data.status !== "REFUNDED" ? [db.product.update({ where: { id: pid }, data: { stock: Math.max(0, p.stock - qty) } })] : []),
      ]);
      return json(created[0], 201);
    }
  }

  return json(await r.delegate.create({ data }), 201);
});
