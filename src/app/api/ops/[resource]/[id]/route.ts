import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { RESOURCES } from "@/lib/resources";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export const PATCH = route<Ctx>(async (req, { params }, user) => {
  const { resource, id } = await params;
  const r = RESOURCES[resource];
  if (!r) return json({ error: "Unknown resource" }, 404);
  if (r.admin && user.role !== "ADMIN") return json({ error: "Admins only" }, 403);
  const data = r.schema.partial().parse(await req.json()) as Record<string, unknown>;

  if (resource === "orders" && data.status === "REFUNDED") {
    const before = await db.storeOrder.findUnique({ where: { id } });
    if (!before) return json({ error: "Not found" }, 404);
    // A refund puts the units back on the shelf (once)
    if (before.status !== "REFUNDED" && before.productId) {
      await db.product.updateMany({ where: { id: before.productId }, data: { stock: { increment: before.quantity } } });
    }
  }
  try {
    return json(await r.delegate.update({ where: { id }, data }));
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return json({ error: "Not found" }, 404);
    throw e;
  }
});

export const DELETE = route<Ctx>(async (_req, { params }, user) => {
  const { resource, id } = await params;
  const r = RESOURCES[resource];
  if (!r) return json({ error: "Unknown resource" }, 404);
  if (r.admin && user.role !== "ADMIN") return json({ error: "Admins only" }, 403);
  await r.delegate.deleteMany({ where: { id } });
  return json({ ok: true });
});
