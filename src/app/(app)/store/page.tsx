import { storeStats } from "@/lib/ops";
import { PageHeader } from "@/components/shell";
import { StoreView } from "@/components/store-view";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const s = await storeStats();
  return (
    <>
      <PageHeader title="Dropshipping store" subtitle="Products, orders, stock and profit for the store" />
      <StoreView
        kpis={s.kpis}
        byStatus={s.byStatus}
        top={s.top}
        lowStockIds={s.lowStock.map((p) => p.id)}
        products={s.products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, supplier: p.supplier, cost: p.cost, price: p.price, stock: p.stock, status: p.status }))}
        orders={s.orders.map((o) => ({ id: o.id, number: o.number, customer: o.customer, productId: o.productId, productName: o.productName, quantity: o.quantity, revenue: o.revenue, cost: o.cost, status: o.status, placedAt: o.placedAt.toISOString().slice(0, 10) }))}
      />
    </>
  );
}
