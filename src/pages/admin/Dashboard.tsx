import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, ClipboardList, DollarSign, TrendingUp, Users, Percent, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "@/lib/formatters";
import { Loader2 } from "lucide-react";

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

      // Upsell stats
      const upsellItems = (orderItems.data || []).filter((i: any) => i.type === "upsell");
      const upsellRevenue = upsellItems.reduce((sum: number, i: any) => sum + i.amount, 0);
      const bumpItems = (orderItems.data || []).filter((i: any) => i.type === "bump");
      const bumpRevenue = bumpItems.reduce((sum: number, i: any) => sum + i.amount, 0);

      // Top products by revenue
      const productRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
      for (const item of (orderItems.data || [])) {
        const pid = (item as any).product_id;
        const pname = (item as any).products?.name || "Desconhecido";
        if (!productRevenue[pid]) productRevenue[pid] = { name: pname, revenue: 0, count: 0 };
        productRevenue[pid].revenue += (item as any).amount;
        productRevenue[pid].count++;
      }
      const topProducts = Object.values(productRevenue)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Abandonment stats
      const totalAbandoned = abandoned.data?.length || 0;
      const recoveredCount = abandoned.data?.filter((a: any) => a.recovered).length || 0;
      const recoveryRate = totalAbandoned > 0 ? (recoveredCount / totalAbandoned) * 100 : 0;

      // Delivery stats
      const deliveriesSent = deliveries.data?.filter((d: any) => d.status === "sent").length || 0;
      const deliveriesFailed = deliveries.data?.filter((d: any) => d.status === "failed").length || 0;

      // Recent orders (last 10)
      const recentOrders = paidOrders.slice(0, 10);

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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const mainCards = [
    { title: "Produtos Ativos", value: stats?.products ?? 0, icon: Package },
    { title: "Checkouts Ativos", value: stats?.checkouts ?? 0, icon: ShoppingCart },
    { title: "Pedidos Pagos", value: stats?.orders ?? 0, icon: ClipboardList },
    { title: "Receita Total", value: formatCents(stats?.revenue ?? 0, "brl"), icon: DollarSign },
  ];

  const secondaryCards = [
    { title: "Receita Upsells", value: formatCents(stats?.upsellRevenue ?? 0, "brl"), icon: ArrowUpRight },
    { title: "Receita Bumps", value: formatCents(stats?.bumpRevenue ?? 0, "brl"), icon: TrendingUp },
    { title: "Taxa Recuperação", value: `${(stats?.recoveryRate ?? 0).toFixed(1)}%`, icon: Percent },
    { title: "Abandonos", value: `${stats?.recoveredCount ?? 0}/${stats?.totalAbandoned ?? 0}`, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top 5 Produtos (por receita)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-3">
                {stats.topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.count} vendas</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{formatCents(p.revenue, "brl")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum produto vendido ainda</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                  stats.recentOrders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{order.customers?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{order.customers?.email}</div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCents(order.total_amount, "brl")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                      Nenhum pedido ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
