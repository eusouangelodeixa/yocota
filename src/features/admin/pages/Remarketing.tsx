import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusPill: Record<string, { label: string; cls: string }> = {
  recovered: { label: "RECUPERADO",       cls: "pill-paid"    },
  whatsapp:  { label: "WHATSAPP ENVIADO", cls: "pill-sent"    },
  pending:   { label: "PENDENTE",         cls: "pill-pending" },
};

const FILTERS = [
  { value: "all",       label: "Todos"      },
  { value: "pending",   label: "Pendentes"  },
  { value: "whatsapp",  label: "Contactado" },
  { value: "recovered", label: "Recuperado" },
];

const getStatusKey = (item: any) => {
  if (item.recovered) return "recovered";
  if (item.whatsapp_sent_at) return "whatsapp";
  return "pending";
};

export default function Remarketing() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-remarketing"],
    queryFn: async () => {
      const { data: abandoned, error } = await supabase
        .from("abandoned_checkouts")
        .select("*, checkouts(name, products!checkouts_product_id_fkey(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return abandoned || [];
    },
  });

  const total      = data?.length || 0;
  const recovered  = data?.filter((a: any) => a.recovered).length || 0;
  const whatsappSent = data?.filter((a: any) => a.whatsapp_sent_at).length || 0;
  const recoveryRate = total > 0 ? ((recovered / total) * 100).toFixed(1) : "0.0";

  const kpis = [
    { label: "ABANDONOS TOTAIS",    value: total },
    { label: "RECUPERADOS",         value: recovered },
    { label: "WHATSAPP ENVIADO",    value: whatsappSent },
    { label: "TAXA DE RECUPERAÇÃO", value: `${recoveryRate}%` },
  ];

  const filtered = statusFilter === "all"
    ? data
    : data?.filter((item: any) => getStatusKey(item) === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Remarketing</h2>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                statusFilter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {f.value !== "all" && data && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {data.filter((item: any) => getStatusKey(item) === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card-surface rounded-[10px] p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">{kpi.label}</p>
            <p className="text-[28px] font-bold text-foreground tabular-nums leading-none">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="card-surface rounded-[10px] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-input">
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Lead</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Checkout</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Telefone</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-24 shimmer rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !filtered?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12 text-[13px]">
                  Nenhum abandono{statusFilter !== "all" ? " com este status" : ""} registrado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item: any) => {
                const key = getStatusKey(item);
                const sp = statusPill[key];
                return (
                  <TableRow key={item.id} className="border-border hover:bg-[rgba(255,255,255,0.02)] h-12">
                    <TableCell>
                      <div className="text-[13px] font-medium text-foreground">{item.name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{item.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] text-muted-foreground">{item.checkouts?.name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground/60">{item.checkouts?.products?.name || ""}</div>
                    </TableCell>
                    <TableCell className="font-mono text-[13px] text-muted-foreground">{item.phone || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${sp.cls}`}>
                        {sp.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
