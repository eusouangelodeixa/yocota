import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, ClipboardList, DollarSign, TrendingUp, Users, Percent, ArrowUpRight, ArrowUp, ArrowDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "@/lib/formatters";
import { useEffect, useRef, useState } from "react";

function SkeletonCard() {
  return (
    <div className="card-glass rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 shimmer rounded" />
        <div className="h-8 w-8 shimmer rounded-lg" />
      </div>
      <div className="h-8 w-32 shimmer rounded" />
      <div className="h-3 w-16 shimmer rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="card-glass rounded-xl overflow-hidden">
      <div className="p-5 border-b border-[rgba(255,255,255,0.06)]">
        <div className="h-4 w-40 shimmer rounded" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-4 shimmer rounded" />
            <div className="h-4 flex-1 shimmer rounded" />
            <div className="h-4 w-20 shimmer rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimatedNumber({ value, prefix = "" }: { value: number | string; prefix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof value !== "number") return;
    const duration = 800;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [value]);

  if (typeof value === "string") {
    return <span className="animate-count-up">{prefix}{value}</span>;
  }

  return <span className="animate-count-up">{prefix}{displayed.toLocaleString("pt-BR")}</span>;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-[#78350f22] text-[#fbbf24] border-0" },
  paid: { label: "Pago", className: "bg-[#28d56a18] text-[#28d56a] border-0" },
  failed: { label: "Falhou", className: "bg-[#ef444418] text-[#ef4444] border-0" },
  refunded: { label: "Reembolso", className: "bg-[#3b82f618] text-[#60a5fa] border-0" },
};

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [products, checkouts, orders, orderItems, abandoned, deliveries] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("checkouts").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("orders").select("id, total_amount, status, created_at, checkout_id, customers(name, email)").order("created_at", { ascending: false }),
        supabase.from("order_items").select("product_id, amount, type, products(name)"),
        supabase.from("abandoned_checkouts").select("id, recovered"),
        supabase.from("deliveries").select("id, status"),
      ]);

      const paidOrders = orders.data?.filter((o: any) => o.status === "paid") ?? [];
      const revenue = paidOrders.reduce((sum: number, o: any) => sum + o.total_amount, 0);

      const upsellItems = (orderItems.data || []).filter((i: any) => i.type === "upsell");
      const upsellRevenue = upsellItems.reduce((sum: number, i: any) => sum + i.amount, 0);
      const bumpItems = (orderItems.data || []).filter((i: any) => i.type === "bump");
      const bumpRevenue = bumpItems.reduce((sum: number, i: any) => sum + i.amount, 0);

      const productRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
      for (const item of (orderItems.data || [])) {
        const pid = (item as any).product_id;
        const pname = (item as any).products?.name || "Desconhecido";
        if (!productRevenue[pid]) productRevenue[pid] = { name: pname, revenue: 0, count: 0 };
        productRevenue[pid].revenue += (item as any).amount;
        productRevenue[pid].count++;
      }
      const topProducts = Object.values(productRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      const totalAbandoned = abandoned.data?.length || 0;
      const recoveredCount = abandoned.data?.filter((a: any) => a.recovered).length || 0;
      const recoveryRate = totalAbandoned > 0 ? (recoveredCount / totalAbandoned) * 100 : 0;

      const deliveriesSent = deliveries.data?.filter((d: any) => d.status === "sent").length || 0;
      const deliveriesFailed = deliveries.data?.filter((d: any) => d.status === "failed").length || 0;

      const recentOrders = (orders.data || []).slice(0, 10);

      return {
        products: products.count ?? 0,
        checkouts: checkouts.count ?? 0,
        orders: paidOrders.length,
        revenue,
        upsellRevenue,
        bumpRevenue,
        topProducts,
        recoveryRate,
        totalAbandoned,
        recoveredCount,
        deliveriesSent,
        deliveriesFailed,
        recentOrders,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 shimmer rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonTable />
          <SkeletonTable />
        </div>
      </div>
    );
  }

  const mainCards = [
    { title: "Receita Total", value: formatCents(stats?.revenue ?? 0, "brl"), icon: DollarSign, color: "text-primary" },
    { title: "Pedidos Pagos", value: stats?.orders ?? 0, icon: ClipboardList, color: "text-primary" },
    { title: "Produtos Ativos", value: stats?.products ?? 0, icon: Package, color: "text-[#60a5fa]" },
    { title: "Checkouts Ativos", value: stats?.checkouts ?? 0, icon: ShoppingCart, color: "text-[#fbbf24]" },
  ];

  const secondaryCards = [
    { title: "Receita Upsells", value: formatCents(stats?.upsellRevenue ?? 0, "brl"), icon: ArrowUpRight, color: "text-primary" },
    { title: "Receita Bumps", value: formatCents(stats?.bumpRevenue ?? 0, "brl"), icon: TrendingUp, color: "text-[#60a5fa]" },
    { title: "Taxa Recuperação", value: `${(stats?.recoveryRate ?? 0).toFixed(1)}%`, icon: Percent, color: "text-[#fbbf24]" },
    { title: "Abandonos", value: `${stats?.recoveredCount ?? 0}/${stats?.totalAbandoned ?? 0}`, icon: Users, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((card, i) => (
          <div key={card.title} className="card-glass rounded-xl p-5 transition-all duration-150 hover:border-[rgba(255,255,255,0.1)]" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</span>
              <div className={`w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.04)] flex items-center justify-center ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground animate-count-up">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryCards.map((card, i) => (
          <div key={card.title} className="card-glass rounded-xl p-5 transition-all duration-150 hover:border-[rgba(255,255,255,0.1)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</span>
              <div className={`w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.04)] flex items-center justify-center ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-foreground">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-sm font-semibold text-foreground">Top 5 Produtos (por receita)</h3>
          </div>
          <div className="p-5">
            {stats?.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-4">
                {stats.topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.count} vendas</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-primary">{formatCents(p.revenue, "brl")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto vendido ainda</p>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-sm font-semibold text-foreground">Pedidos Recentes</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(255,255,255,0.06)] hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs font-medium">Cliente</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium">Valor</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium">Status</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                stats.recentOrders.map((order: any) => {
                  const sb = statusBadge[order.status] || statusBadge.pending;
                  return (
                    <TableRow key={order.id} className="border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-150">
                      <TableCell>
                        <div className="text-sm font-medium text-foreground">{order.customers?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{order.customers?.email}</div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{formatCents(order.total_amount, "brl")}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sb.className}`}>
                          {sb.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhum pedido ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
