"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";
import { Button, Card, CardHeader, Empty, Select } from "./ui";
import { EntityDialog, Pill, RowActions, StatCard, Tabs, dlgKey, ops } from "./biz";
import { FIELDS, today } from "@/lib/fields";
import { ORDER_STATUS } from "@/lib/constants";
import { money } from "@/lib/utils";

type Product = { id: string; name: string; sku: string | null; supplier: string | null; cost: number; price: number; stock: number; status: string };
type Order = { id: string; number: string; customer: string; productId: string | null; productName: string; quantity: number; revenue: number; cost: number; status: string; placedAt: string };
type Kpis = { revenue: number; profit: number; margin: number; orders: number; toShip: number; stockValue: number; refundRate: number };

export function StoreView({ kpis, byStatus, top, lowStockIds, products, orders }: { kpis: Kpis; byStatus: Record<string, number>; top: { name: string; units: number; profit: number }[]; lowStockIds: string[]; products: Product[]; orders: Order[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"orders" | "products">("orders");
  const [dlg, setDlg] = React.useState<{ kind: "order" | "product"; id?: string } | null>(null);
  const low = new Set(lowStockIds);
  const productOpts = products.map((p) => ({ value: p.id, label: p.name }));
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  async function setStatus(id: string, status: string) {
    await ops("PATCH", `/api/ops/orders/${id}`, { status });
    router.refresh();
  }

  const editing = dlg?.id ? (dlg.kind === "order" ? orders.find((o) => o.id === dlg.id) : products.find((p) => p.id === dlg.id)) : undefined;
  const asValues = (o: object | undefined) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v == null ? "" : String(v)])) : undefined);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Revenue" value={money(kpis.revenue)} sub="excl. refunds" />
        <StatCard label="Profit" value={money(kpis.profit)} tone={kpis.profit >= 0 ? "good" : "bad"} sub={`${kpis.margin}% margin`} />
        <StatCard label="Orders" value={String(kpis.orders)} sub={`${byStatus.DELIVERED ?? 0} delivered`} />
        <StatCard label="To ship" value={String(kpis.toShip)} tone={kpis.toShip ? "warn" : undefined} sub="pending orders" />
        <StatCard label="Stock value" value={money(kpis.stockValue)} sub="at your cost" />
        <StatCard label="Refund rate" value={`${kpis.refundRate}%`} tone={kpis.refundRate > 10 ? "bad" : undefined} />
      </div>

      {lowStockIds.length > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle size={16} /> Low stock: {products.filter((p) => low.has(p.id)).map((p) => `${p.name} (${p.stock})`).join(", ")}
        </p>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Tabs value={tab} onChange={setTab} items={[{ id: "orders", label: "Orders", count: orders.length }, { id: "products", label: "Products", count: products.length }]} />
            <Button variant="primary" onClick={() => setDlg({ kind: tab === "orders" ? "order" : "product" })}><Plus size={16} /> {tab === "orders" ? "New order" : "Add product"}</Button>
          </div>

          {tab === "orders" ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-surface-2/60 text-left text-xs text-muted">
                    <th className="px-5 py-3 font-medium">Order</th><th className="px-3 py-3 font-medium">Product</th><th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Sale</th><th className="px-3 py-3 text-right font-medium">Profit</th><th className="px-3 py-3" />
                  </tr></thead>
                  <tbody>
                    {orders.map((o) => {
                      const profit = o.status === "REFUNDED" ? -o.cost : o.revenue - o.cost;
                      return (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-surface-2/50">
                          <td className="px-5 py-3"><p className="font-medium">#{o.number}</p><p className="text-xs text-muted">{o.customer} · {o.placedAt}</p></td>
                          <td className="px-3 py-3">{o.productName}<span className="text-muted"> × {o.quantity}</span></td>
                          <td className="px-3 py-3">
                            <Select className="h-8 w-auto text-xs" value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} aria-label={`Status of order ${o.number}`}>
                              {ORDER_STATUS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                            </Select>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{money(o.revenue)}</td>
                          <td className={`px-3 py-3 text-right font-medium tabular-nums ${profit < 0 ? "text-rose-600" : "text-emerald-600"}`}>{money(profit)}</td>
                          <td className="px-3 py-3 text-right"><RowActions resource="orders" id={o.id} label={`order ${o.number}`} onEdit={() => setDlg({ kind: "order", id: o.id })} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {orders.length === 0 && <Empty title="No orders yet" hint="Add an order when a customer buys. Stock updates automatically." />}
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-surface-2/60 text-left text-xs text-muted">
                    <th className="px-5 py-3 font-medium">Product</th><th className="px-3 py-3 font-medium">Supplier</th><th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Cost → Price</th><th className="px-3 py-3 text-right font-medium">Margin</th><th className="px-3 py-3 text-right font-medium">Stock</th><th className="px-3 py-3" />
                  </tr></thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-surface-2/50">
                        <td className="px-5 py-3"><p className="font-medium">{p.name}</p>{p.sku && <p className="text-xs text-muted">{p.sku}</p>}</td>
                        <td className="px-3 py-3 text-xs text-muted">{p.supplier ?? "—"}</td>
                        <td className="px-3 py-3"><Pill value={p.status} /></td>
                        <td className="px-3 py-3 text-right tabular-nums">{money(p.cost)} → {money(p.price)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0}%</td>
                        <td className={`px-3 py-3 text-right font-medium tabular-nums ${low.has(p.id) ? "text-amber-600" : ""}`}>{p.stock}</td>
                        <td className="px-3 py-3 text-right"><RowActions resource="products" id={p.id} label={p.name} onEdit={() => setDlg({ kind: "product", id: p.id })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {products.length === 0 && <Empty title="No products yet" hint="Add what you sell, with your cost and selling price, to track margin and stock." />}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Order pipeline" />
            <ul className="space-y-2 px-5 pb-5 text-sm">
              {ORDER_STATUS.map((s) => <li key={s} className="flex items-center justify-between"><Pill value={s} /><span className="font-medium tabular-nums">{byStatus[s] ?? 0}</span></li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Top products" subtitle="By profit" />
            {top.length === 0 ? <Empty title="No sales yet" /> : (
              <ul className="space-y-3 px-5 pb-5 text-sm">
                {top.map((t) => <li key={t.name} className="flex justify-between gap-3"><span className="truncate">{t.name}<span className="text-xs text-muted"> · {t.units} sold</span></span><span className="font-medium tabular-nums">{money(t.profit)}</span></li>)}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <EntityDialog
        key={dlgKey(dlg?.id, !!dlg) + (dlg?.kind ?? "")}
        open={!!dlg}
        onClose={() => setDlg(null)}
        title={dlg?.kind === "order" ? (dlg.id ? "Edit order" : "New order") : dlg?.id ? "Edit product" : "Add product"}
        resource={dlg?.kind === "order" ? "orders" : "products"}
        fields={dlg?.kind === "order" ? FIELDS.orders(productOpts) : FIELDS.products}
        id={dlg?.id}
        initial={asValues(editing) ?? (dlg?.kind === "order" ? { number: String(1000 + orders.length + 1), placedAt: today(), quantity: "1", status: "PENDING", revenue: "0", cost: "0" } : { status: "ACTIVE", cost: "0", price: "0", stock: "0" })}
        autofill={dlg?.kind === "order" ? (v, changed) => {
          const p = byId[v.productId];
          if (!p || (changed !== "productId" && changed !== "quantity")) return {};
          const q = Math.max(1, Number(v.quantity) || 1);
          return { productName: p.name, revenue: String(+(p.price * q).toFixed(2)), cost: String(+(p.cost * q).toFixed(2)) };
        } : undefined}
      />
    </>
  );
}
