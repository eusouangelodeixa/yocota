import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Package, ShoppingCart, ClipboardList, DollarSign,
  TrendingUp, Users, Percent, ArrowUpRight,
  CalendarIcon, ChevronDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "@/lib/formatters";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth, startOfYear, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Skeletons ── */
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

/* ── Animated Number ── */
function AnimatedNumber({ value, prefix = "" }: { value: number | string; prefix?: string }) {
  const [displayed, setDisplayed] = useState(0);
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
  if (typeof value === "string") return <span>{prefix}{value}</span>;
  return <span>{prefix}{displayed.toLocaleString("pt-BR")}</span>;
}

/* ── Status badges ── */
const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-[#78350f22] text-[#fbbf24] border-0" },
  paid: { label: "Pago", className: "bg-[#28d56a18] text-[#28d56a] border-0" },
  failed: { label: "Falhou", className: "bg-[#ef444418] text-[#ef4444] border-0" },
  refunded: { label: "Reembolso", className: "bg-[#3b82f618] text-[#60a5fa] border-0" },
};

/* ── Date filter presets ── */
type FilterPreset = "today" | "7d" | "30d" | "year" | "custom";

const PRESET_LABELS: Record<FilterPreset, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "Mês",
  year: "Ano",
  custom: "Personalizado",
};

function getDateRange(preset: FilterPreset, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "7d": return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "30d": return { from: startOfMonth(now), to: endOfDay(now) };
    case "year": return { from: startOfYear(now), to: endOfDay(now) };
    case "custom": return { from: startOfDay(customFrom || subDays(now, 30)), to: endOfDay(customTo || now) };
  }
}

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {formatCents(entry.value, "brl")}
        </p>
      ))}
    </div>
  );
}

/* ── Main ── */
export default function Dashboard() {
  const [preset, setPreset] = useState<FilterPreset>("30d");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateRange = useMemo(() => getDateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const { data: allData, isLoading } = useQuery({
    queryKey: ["admin-dashboard-all"],
    queryFn: async () => {
      const [products, checkouts, orders, orderItems, abandoned, deliveries] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("checkouts").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("orders").select("id, total_amount, status, created_at, checkout_id, customers(name, email)").order("created_at", { ascending: false }),
        supabase.from("order_items").select("product_id, amount, type, products(name)"),
        supabase.from("abandoned_checkouts").select("id, recovered, created_at"),
        supabase.from("deliveries").select("id, status"),
      ]);
      return {
        productsCount: products.count ?? 0,
        checkoutsCount: checkouts.count ?? 0,
        orders: orders.data || [],
        orderItems: orderItems.data || [],
        abandoned: abandoned.data || [],
        deliveries: deliveries.data || [],
      };
    },
  });

  /* ── Filtered stats ── */
  const stats = useMemo(() => {
    if (!allData) return null;
    const { orders, orderItems, abandoned } = allData;

    const filteredOrders = orders.filter((o: any) =>
      isWithinInterval(new Date(o.created_at), { start: dateRange.from, end: dateRange.to })
    );
    const paidOrders = filteredOrders.filter((o: any) => o.status === "paid");
    const revenue = paidOrders.reduce((sum: number, o: any) => sum + o.total_amount, 0);

    // All-time items for product ranking
    const upsellRevenue = orderItems.filter((i: any) => i.type === "upsell").reduce((s: number, i: any) => s + i.amount, 0);
    const bumpRevenue = orderItems.filter((i: any) => i.type === "bump").reduce((s: number, i: any) => s + i.amount, 0);

    const productRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
    for (const item of orderItems) {
      const pid = (item as any).product_id;
      const pname = (item as any).products?.name || "Desconhecido";
      if (!productRevenue[pid]) productRevenue[pid] = { name: pname, revenue: 0, count: 0 };
      productRevenue[pid].revenue += (item as any).amount;
      productRevenue[pid].count++;
    }
    const topProducts = Object.values(productRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const filteredAbandoned = abandoned.filter((a: any) =>
      isWithinInterval(new Date(a.created_at), { start: dateRange.from, end: dateRange.to })
    );
    const totalAbandoned = filteredAbandoned.length;
    const recoveredCount = filteredAbandoned.filter((a: any) => a.recovered).length;
    const recoveryRate = totalAbandoned > 0 ? (recoveredCount / totalAbandoned) * 100 : 0;

    // Chart data: group by day
    const dayMap: Record<string, number> = {};
    for (const o of paidOrders) {
      const day = format(new Date((o as any).created_at), "dd/MM", { locale: ptBR });
      dayMap[day] = (dayMap[day] || 0) + (o as any).total_amount;
    }
    const chartData = Object.entries(dayMap).map(([day, value]) => ({ day, value }));

    // Orders by status chart
    const statusCounts = { paid: 0, pending: 0, failed: 0, refunded: 0 };
    for (const o of filteredOrders) {
      const s = (o as any).status as keyof typeof statusCounts;
      if (s in statusCounts) statusCounts[s]++;
    }

    return {
      productsCount: allData.productsCount,
      checkoutsCount: allData.checkoutsCount,
      totalOrders: paidOrders.length,
      revenue,
      upsellRevenue,
      bumpRevenue,
      topProducts,
      recoveryRate,
      totalAbandoned,
      recoveredCount,
      recentOrders: filteredOrders.slice(0, 10),
      chartData,
      statusCounts,
    };
  }, [allData, dateRange]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 shimmer rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const mainCards = [
    { title: "Receita Total", value: formatCents(stats?.revenue ?? 0, "brl"), icon: DollarSign, color: "text-primary" },
    { title: "Pedidos Pagos", value: stats?.totalOrders ?? 0, icon: ClipboardList, color: "text-primary" },
    { title: "Produtos Ativos", value: stats?.productsCount ?? 0, icon: Package, color: "text-[#60a5fa]" },
    { title: "Checkouts Ativos", value: stats?.checkoutsCount ?? 0, icon: ShoppingCart, color: "text-[#fbbf24]" },
  ];

  const secondaryCards = [
    { title: "Receita Upsells", value: formatCents(stats?.upsellRevenue ?? 0, "brl"), icon: ArrowUpRight, color: "text-primary" },
    { title: "Receita Bumps", value: formatCents(stats?.bumpRevenue ?? 0, "brl"), icon: TrendingUp, color: "text-[#60a5fa]" },
    { title: "Taxa Recuperação", value: `${(stats?.recoveryRate ?? 0).toFixed(1)}%`, icon: Percent, color: "text-[#fbbf24]" },
    { title: "Abandonos", value: `${stats?.recoveredCount ?? 0}/${stats?.totalAbandoned ?? 0}`, icon: Users, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

        <div className="flex items-center gap-2">
          {(["today", "7d", "30d", "year"] as FilterPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                preset === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-[rgba(255,255,255,0.04)] text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.08)]"
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={() => { setPreset("custom"); setCalendarOpen(true); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 ${
                  preset === "custom"
                    ? "bg-primary text-primary-foreground"
                    : "bg-[rgba(255,255,255,0.04)] text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.08)]"
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {preset === "custom" && customFrom && customTo
                  ? `${format(customFrom, "dd/MM")} - ${format(customTo, "dd/MM")}`
                  : "Personalizado"
                }
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: customFrom, to: customTo }}
                onSelect={(range: any) => {
                  setCustomFrom(range?.from);
                  setCustomTo(range?.to);
                  if (range?.from && range?.to) setCalendarOpen(false);
                }}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((card) => (
          <div key={card.title} className="card-glass rounded-xl p-5 transition-all duration-150 hover:border-[rgba(255,255,255,0.1)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</span>
              <div className={`w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.04)] flex items-center justify-center ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {typeof card.value === "number" ? <AnimatedNumber value={card.value} /> : card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryCards.map((card) => (
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-sm font-semibold text-foreground">Faturamento por Dia</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Receita dos pedidos pagos no período</p>
          </div>
          <div className="p-5 h-[280px]">
            {stats?.chartData && stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "#888" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#888" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCents(v, "brl")}
                    width={80}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" fill="#28d56a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Nenhum dado no período
              </div>
            )}
          </div>
        </div>

        {/* Revenue Area Chart (cumulative) */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-sm font-semibold text-foreground">Receita Acumulada</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Evolução do faturamento no período</p>
          </div>
          <div className="p-5 h-[280px]">
            {stats?.chartData && stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats.chartData.reduce((acc: any[], item, i) => {
                    const prev = i > 0 ? acc[i - 1].cumulative : 0;
                    acc.push({ ...item, cumulative: prev + item.value });
                    return acc;
                  }, [])}
                >
                  <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#28d56a" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#28d56a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "#888" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#888" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCents(v, "brl")}
                    width={80}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#28d56a"
                    strokeWidth={2}
                    fill="url(#greenGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Nenhum dado no período
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-sm font-semibold text-foreground">Top 5 Produtos (por receita)</h3>
          </div>
          <div className="p-5">
            {stats?.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-4">
                {stats.topProducts.map((p, i) => {
                  const maxRev = stats.topProducts[0].revenue;
                  const pct = maxRev > 0 ? (p.revenue / maxRev) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.count} vendas</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-primary">{formatCents(p.revenue, "brl")}</span>
                      </div>
                      <div className="h-1.5 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden ml-8">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
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
                    Nenhum pedido no período
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
