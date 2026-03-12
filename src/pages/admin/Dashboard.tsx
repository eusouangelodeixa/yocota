import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "@/lib/formatters";
import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth, startOfYear, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Skeleton ── */
function SkeletonCard() {
  return (
    <div className="card-surface rounded-[10px] p-5 space-y-3">
      <div className="h-3 w-24 shimmer rounded" />
      <div className="h-7 w-32 shimmer rounded" />
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

/* ── Status pills ── */
const statusPill: Record<string, { label: string; cls: string }> = {
  pending: { label: "PENDENTE", cls: "pill-pending" },
  paid: { label: "PAGO", cls: "pill-paid" },
  failed: { label: "FALHOU", cls: "pill-failed" },
  refunded: { label: "REEMBOLSO", cls: "pill-refunded" },
};

/* ── Date filter ── */
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

/* ── Tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-elevated rounded-lg px-3.5 py-2.5">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold text-foreground">
          {formatCents(entry.value)}
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
        supabase.from("orders").select("id, total_amount, status, created_at, checkout_id, currency, customers(name, email)").order("created_at", { ascending: false }),
        supabase.from("order_items").select("product_id, amount, type, products(name, currency)"),
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

  const stats = useMemo(() => {
    if (!allData) return null;
    const { orders, orderItems, abandoned } = allData;

    const filteredOrders = orders.filter((o: any) =>
      isWithinInterval(new Date(o.created_at), { start: dateRange.from, end: dateRange.to })
    );
    const paidOrders = filteredOrders.filter((o: any) => o.status === "paid");
    const revenue = paidOrders.reduce((sum: number, o: any) => sum + o.total_amount, 0);

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

    const dayMap: Record<string, number> = {};
    for (const o of paidOrders) {
      const day = format(new Date((o as any).created_at), "dd/MM", { locale: ptBR });
      dayMap[day] = (dayMap[day] || 0) + (o as any).total_amount;
    }
    const chartData = Object.entries(dayMap).map(([day, value]) => ({ day, value }));

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
    };
  }, [allData, dateRange]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 shimmer rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "RECEITA TOTAL", value: formatCents(stats?.revenue ?? 0), change: null },
    { label: "PEDIDOS PAGOS", value: stats?.totalOrders ?? 0, change: null },
    { label: "PRODUTOS ATIVOS", value: stats?.productsCount ?? 0, change: null },
    { label: "CHECKOUTS ATIVOS", value: stats?.checkoutsCount ?? 0, change: null },
    { label: "RECEITA UPSELLS", value: formatCents(stats?.upsellRevenue ?? 0), change: null },
    { label: "RECEITA BUMPS", value: formatCents(stats?.bumpRevenue ?? 0), change: null },
    { label: "TAXA RECUPERAÇÃO", value: `${(stats?.recoveryRate ?? 0).toFixed(1)}%`, change: null },
    { label: "ABANDONOS", value: `${stats?.recoveredCount ?? 0}/${stats?.totalAbandoned ?? 0}`, change: null },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-foreground">Dashboard</h2>
        <div className="flex items-center gap-1">
          {(["today", "7d", "30d", "year"] as FilterPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                preset === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
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
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card-surface rounded-[10px] p-4 md:p-5">
            <p className="text-[10px] md:text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">{kpi.label}</p>
            <p className="text-xl md:text-[28px] font-bold text-foreground tabular-nums leading-none">
              {typeof kpi.value === "number" ? <AnimatedNumber value={kpi.value} /> : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Bar Chart */}
        <div className="card-surface rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Faturamento por Dia</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Receita dos pedidos pagos no período</p>
          </div>
          <div className="p-5 h-[280px]">
            {stats?.chartData && stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCents(v)} width={80} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                  <Bar dataKey="value" fill="#27272a" activeBar={{ fill: "#E04B00" }} radius={0} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado no período</div>
            )}
          </div>
        </div>

        {/* Cumulative Area Chart */}
        <div className="card-surface rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Receita Acumulada</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Evolução do faturamento no período</p>
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
                    <linearGradient id="accentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E04B00" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#E04B00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCents(v)} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="cumulative" stroke="#E04B00" strokeWidth={2} fill="url(#accentGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado no período</div>
            )}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="card-surface rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Top 5 Produtos</h3>
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
                          <span className="text-[11px] font-bold text-muted-foreground w-4">{i + 1}.</span>
                          <div>
                            <p className="text-[13px] font-medium text-foreground">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">{p.count} vendas</p>
                          </div>
                        </div>
                        <span className="text-[13px] font-semibold text-primary tabular-nums">{formatCents(p.revenue)}</span>
                      </div>
                      <div className="h-1 bg-secondary rounded-full overflow-hidden ml-7">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground text-center py-6">Nenhum produto vendido ainda</p>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card-surface rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Pedidos Recentes</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cliente</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Valor</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                stats.recentOrders.map((order: any) => {
                  const sp = statusPill[order.status] || statusPill.pending;
                  return (
                    <TableRow key={order.id} className="border-border hover:bg-[rgba(255,255,255,0.02)] h-12">
                      <TableCell>
                        <div className="text-[13px] font-medium text-foreground">{order.customers?.name || "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{order.customers?.email}</div>
                      </TableCell>
                      <TableCell className="text-[13px] font-medium text-foreground tabular-nums">{formatCents(order.total_amount, "eur")}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${sp.cls}`}>
                          {sp.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-[13px]">Nenhum pedido no período</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
