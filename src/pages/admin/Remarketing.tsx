import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserCheck, MessageSquare, TrendingUp } from "lucide-react";

const statusBadge: Record<string, { label: string; className: string }> = {
  recovered: { label: "Recuperado", className: "bg-[#28d56a18] text-[#28d56a]" },
  whatsapp: { label: "WhatsApp enviado", className: "bg-[#3b82f618] text-[#60a5fa]" },
  pending: { label: "Pendente", className: "bg-[#78350f22] text-[#fbbf24]" },
};

export default function Remarketing() {
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

  const total = data?.length || 0;
  const recovered = data?.filter((a: any) => a.recovered).length || 0;
  const whatsappSent = data?.filter((a: any) => a.whatsapp_sent_at).length || 0;
  const recoveryRate = total > 0 ? ((recovered / total) * 100).toFixed(1) : "0.0";

  const statCards = [
    { title: "Abandonos Totais", value: total, icon: Users, color: "text-muted-foreground" },
    { title: "Recuperados", value: recovered, icon: UserCheck, color: "text-primary" },
    { title: "WhatsApp Enviado", value: whatsappSent, icon: MessageSquare, color: "text-[#60a5fa]" },
    { title: "Taxa de Recuperação", value: `${recoveryRate}%`, icon: TrendingUp, color: "text-[#fbbf24]" },
  ];

  const getStatus = (item: any) => {
    if (item.recovered) return statusBadge.recovered;
    if (item.whatsapp_sent_at) return statusBadge.whatsapp;
    return statusBadge.pending;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Remarketing</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="card-glass rounded-xl p-5 transition-all duration-150 hover:border-[rgba(255,255,255,0.1)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</span>
              <div className={`w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.04)] flex items-center justify-center ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card-glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[rgba(255,255,255,0.06)] hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs font-medium">Lead</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Checkout</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Telefone</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-[rgba(255,255,255,0.04)]">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-24 shimmer rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (!data || data.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Nenhum abandono registrado
                </TableCell>
              </TableRow>
            ) : (
              data.map((item: any) => {
                const sb = getStatus(item);
                return (
                  <TableRow key={item.id} className="border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-150">
                    <TableCell>
                      <div className="font-medium text-foreground">{item.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{item.checkouts?.name || "—"}</div>
                      <div className="text-xs text-[#555555]">{item.checkouts?.products?.name || ""}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{item.phone || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border-0 ${sb.className}`}>
                        {sb.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
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
