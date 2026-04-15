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
import { format, subDays, startOfDay, endOfDay, startOfMonth, startOfYear, isWithinInterval, getDay } from "date-fns";
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

/* ── Compact Y-axis formatter ── */
function compactAxis(v: number): string {
  const amount = v / 100;
  if (amount === 0) return "0";
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString("pt-PT", { maximumFractionDigits: 0 });
}

/* ── Tooltip ── */
function ChartTooltip({ active, payload, label, currency = "eur" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-elevated rounded-lg px-3.5 py-2.5">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold text-foreground">
          {formatCents(entry.value, currency)}
        </p>
      ))}
    </div>
  );
}

/* ── Main ── */
export default function Dashboard() {
  const [preset, setPreset] = useState<FilterPreset>("today");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<"MZN" | "USD" | "EUR" | "BRL">("MZN");

  const dateRange = useMemo(() => getDateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const { data: allData, isLoading } = useQuery({
    queryKey: ["admin-dashboard-all"],
    queryFn: async () => {
      const [products, checkouts, orders, orderItems, abandoned, deliveries] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("checkouts").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("orders").select("id, total_amount, status, created_at, checkout_id, currency, wallet_type, payment_provider, customers(name, email)").order("created_at", { ascending: false }),
        supabase.from("order_items").select("order_id, product_id, amount, type, products(name, currency)"),
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

    const filteredOrders = orders.filter((o: any) => {
      const dateMatch = isWithinInterval(new Date(o.created_at), { start: dateRange.from, end: dateRange.to });
      if (!dateMatch) return false;
      
      const currency = (o.currency || "eur").toUpperCase();
      return currency === selectedCurrency;
    });
    const paidOrders = filteredOrders.filter((o: any) => o.status === "paid");

    // Group revenue by currency
    const revenueByCurrency: Record<string, number> = {};
    for (const o of paidOrders) {
      const cur = (o as any).currency || "eur";
      revenueByCurrency[cur] = (revenueByCurrency[cur] || 0) + (o as any).total_amount;
    }

    // Filter order items to only include those from paid orders in the date range
    const paidOrderIds = new Set(paidOrders.map((o: any) => o.id));
    const paidOrderCurrency: Record<string, string> = {};
    for (const o of paidOrders) paidOrderCurrency[(o as any).id] = (o as any).currency || "eur";
    const filteredItems = orderItems.filter((i: any) => paidOrderIds.has(i.order_id));

    // Group upsell/bump revenue by currency
    const upsellByCurrency: Record<string, number> = {};
    const bumpByCurrency: Record<string, number> = {};
    for (const item of filteredItems) {
      const cur = paidOrderCurrency[(item as any).order_id] || "eur";
      if ((item as any).type === "upsell") upsellByCurrency[cur] = (upsellByCurrency[cur] || 0) + (item as any).amount;
      if ((item as any).type === "bump") bumpByCurrency[cur] = (bumpByCurrency[cur] || 0) + (item as any).amount;
    }

    const productRevenue: Record<string, { name: string; revenue: number; count: number; currency: string }> = {};
    for (const item of filteredItems) {
      const pid = (item as any).product_id;
      const pname = (item as any).products?.name || "Desconhecido";
      const pcur = (item as any).products?.currency || paidOrderCurrency[(item as any).order_id] || "eur";
      if (!productRevenue[pid]) productRevenue[pid] = { name: pname, revenue: 0, count: 0, currency: pcur };
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

    // ── A: Faturamento por Dia da Semana (Seg→Dom) ──────────────────────────────
    // Day index: 0=Sun,1=Mon,...,6=Sat → remap to Mon=0...Sun=6
    const DOW_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const dowMap: number[] = [0, 0, 0, 0, 0, 0, 0]; // Mon…Sun
    for (const o of paidOrders) {
      const d = getDay(new Date((o as any).created_at)); // 0=Sun…6=Sat
      const idx = d === 0 ? 6 : d - 1; // remap: Mon→0, …, Sun→6
      dowMap[idx] += (o as any).total_amount;
    }
    const weekdayChartData = DOW_LABELS.map((label, i) => ({ day: label, value: dowMap[i] }));

    // ── B: Taxa de Aprovação e-Mola vs M-Pesa + Conversão Geral ────────────────
    // payment_method stored in orders ("emola" | "mpesa" | "stripe")
    const allFilteredOrders = orders.filter((o: any) =>
      isWithinInterval(new Date(o.created_at), { start: dateRange.from, end: dateRange.to }) &&
      (o.currency || "eur").toUpperCase() === selectedCurrency
    );

    // Count by wallet type
    let emolaTotal = 0, emolaPaid = 0;
    let mpesaTotal = 0, mpesaPaid = 0;
    for (const o of allFilteredOrders) {
      const wt = ((o as any).wallet_type || "").toLowerCase();
      if (wt === "emola" || wt === "e-mola") {
        emolaTotal++;
        if (o.status === "paid") emolaPaid++;
      } else if (wt === "mpesa" || wt === "m-pesa") {
        mpesaTotal++;
        if (o.status === "paid") mpesaPaid++;
      }
    }

    // Overall conversion: paid / total (all statuses)
    const totalAllOrders = allFilteredOrders.length;
    const totalPaid = paidOrders.length;
    const conversionRate = totalAllOrders > 0 ? (totalPaid / totalAllOrders) * 100 : 0;
    const emolaApproval = emolaTotal > 0 ? (emolaPaid / emolaTotal) * 100 : null;
    const mpesaApproval = mpesaTotal > 0 ? (mpesaPaid / mpesaTotal) * 100 : null;

    return {
      productsCount: allData.productsCount,
      checkoutsCount: allData.checkoutsCount,
      totalOrders: paidOrders.length,
      revenueByCurrency,
      upsellByCurrency,
      bumpByCurrency,
      topProducts,
      recoveryRate,
      totalAbandoned,
      recoveredCount,
      recentOrders: filteredOrders.slice(0, 10),
      chartData,
      weekdayChartData,
      chartCurrency,
      emolaApproval, emolaTotal, emolaPaid,
      mpesaApproval, mpesaTotal, mpesaPaid,
      conversionRate, totalAllOrders, totalPaid,
    };
  }, [allData, dateRange, selectedCurrency]);

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

  const formatByCurrency = (map: Record<string, number> | undefined, fallback: string = "EUR") => {
    if (!map || Object.keys(map).length === 0) return formatCents(0, fallback);
    return Object.entries(map)
      .map(([cur, amount]) => formatCents(amount, cur))
      .join(" + ");
  };

  const kpis = [
    { label: "RECEITA TOTAL", value: formatByCurrency(stats?.revenueByCurrency, selectedCurrency), change: null },
    { label: "PEDIDOS PAGOS", value: stats?.totalOrders ?? 0, change: null },
    { label: "PRODUTOS ATIVOS", value: stats?.productsCount ?? 0, change: null },
    { label: "CHECKOUTS ATIVOS", value: stats?.checkoutsCount ?? 0, change: null },
    { label: "RECEITA UPSELLS", value: formatByCurrency(stats?.upsellByCurrency, selectedCurrency), change: null },
    { label: "RECEITA BUMPS", value: formatByCurrency(stats?.bumpByCurrency, selectedCurrency), change: null },
    { label: "TAXA RECUPERAÇÃO", value: `${(stats?.recoveryRate ?? 0).toFixed(1)}%`, change: null },
    { label: "ABANDONOS", value: `${stats?.recoveredCount ?? 0}/${stats?.totalAbandoned ?? 0}`, change: null },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-foreground">Dashboard</h2>
          <div className="flex items-center gap-2 mt-1">
            {(["MZN", "USD", "EUR", "BRL"] as const).map((cur) => (
              <button
                key={cur}
                onClick={() => setSelectedCurrency(cur)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all ${
                  selectedCurrency === cur 
                    ? (cur === "MZN" ? "bg-[#28d56a] text-white" : "bg-primary text-primary-foreground")
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
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
        {/* A: Faturamento por Dia da Semana */}
        <div className="card-surface rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Faturamento por Dia da Semana</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Receita acumulada por dia · Segunda a Domingo</p>
          </div>
          <div className="p-5 h-[260px]">
            {stats?.weekdayChartData && stats.weekdayChartData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weekdayChartData} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradDow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E04B00" stopOpacity={1} />
                      <stop offset="100%" stopColor="#E04B00" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={54} />
                  <Tooltip content={<ChartTooltip currency={stats?.chartCurrency || "mzn"} />} cursor={{ fill: "rgba(128,128,128,0.06)", radius: 6 }} />
                  <Bar dataKey="value" fill="url(#barGradDow)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-lg">📊</div>
                <p className="text-sm text-muted-foreground">Sem vendas no período</p>
              </div>
            )}
          </div>
        </div>

        {/* B: Taxas de Aprovação + Conversão */}
        <div className="card-surface rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Taxas de Aprovação e Conversão</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">e-Mola · M-Pesa · Conversão geral</p>
          </div>
          <div className="p-5 h-[260px] flex flex-col justify-center gap-5">

            {/* Conversão Geral */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Conversão Geral</p>
                  <p className="text-[10px] text-muted-foreground">{stats?.totalPaid ?? 0} pagos de {stats?.totalAllOrders ?? 0} tentativas</p>
                </div>
                <span className="text-[22px] font-bold tabular-nums" style={{ color: (() => {
                  const r = stats?.conversionRate ?? 0;
                  return r >= 60 ? "#22c55e" : r >= 35 ? "#f59e0b" : "#ef4444";
                })() }}>
                  {(stats?.conversionRate ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(stats?.conversionRate ?? 0, 100)}%`,
                    backgroundColor: (() => {
                      const r = stats?.conversionRate ?? 0;
                      return r >= 60 ? "#22c55e" : r >= 35 ? "#f59e0b" : "#ef4444";
                    })(),
                  }}
                />
              </div>
            </div>

            <div className="border-t border-border" />

            {/* e-Mola */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/assets/emola-logo.png" className="h-5 object-contain" alt="e-Mola" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">e-Mola</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stats?.emolaApproval !== null ? `${stats?.emolaPaid} pagos de ${stats?.emolaTotal}` : "Sem dados"}
                    </p>
                  </div>
                </div>
                <span className="text-[20px] font-bold tabular-nums" style={{ color: stats?.emolaApproval !== null ? (stats!.emolaApproval! >= 60 ? "#22c55e" : stats!.emolaApproval! >= 35 ? "#f59e0b" : "#ef4444") : "#52525b" }}>
                  {stats?.emolaApproval !== null ? `${stats!.emolaApproval!.toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(stats?.emolaApproval ?? 0, 100)}%`,
                    backgroundColor: stats?.emolaApproval !== null ? (stats!.emolaApproval! >= 60 ? "#22c55e" : stats!.emolaApproval! >= 35 ? "#f59e0b" : "#ef4444") : "#3f3f46",
                  }}
                />
              </div>
            </div>

            {/* M-Pesa */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/assets/mpesa-logo.png" className="h-5 object-contain" alt="M-Pesa" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">M-Pesa</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stats?.mpesaApproval !== null ? `${stats?.mpesaPaid} pagos de ${stats?.mpesaTotal}` : "Sem dados"}
                    </p>
                  </div>
                </div>
                <span className="text-[20px] font-bold tabular-nums" style={{ color: stats?.mpesaApproval !== null ? (stats!.mpesaApproval! >= 60 ? "#22c55e" : stats!.mpesaApproval! >= 35 ? "#f59e0b" : "#ef4444") : "#52525b" }}>
                  {stats?.mpesaApproval !== null ? `${stats!.mpesaApproval!.toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(stats?.mpesaApproval ?? 0, 100)}%`,
                    backgroundColor: stats?.mpesaApproval !== null ? (stats!.mpesaApproval! >= 60 ? "#22c55e" : stats!.mpesaApproval! >= 35 ? "#f59e0b" : "#ef4444") : "#3f3f46",
                  }}
                />
              </div>
            </div>

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
                        <span className="text-[13px] font-semibold text-primary tabular-nums">{formatCents(p.revenue, p.currency)}</span>
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
                      <TableCell className="text-[13px] font-medium text-foreground tabular-nums">{formatCents(order.total_amount, order.currency || "eur")}</TableCell>
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
