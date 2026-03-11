import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCentsToBRL } from "@/lib/formatters";

const statusPill: Record<string, { label: string; cls: string }> = {
  pending: { label: "PENDENTE", cls: "pill-pending" },
  paid: { label: "PAGO", cls: "pill-paid" },
  failed: { label: "FALHOU", cls: "pill-failed" },
  refunded: { label: "REEMBOLSO", cls: "pill-refunded" },
};

export default function Orders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(name, email), checkouts(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Pedidos</h2>
      <div className="card-surface rounded-[10px] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-input">
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cliente</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Checkout</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><div className="h-4 w-32 shimmer rounded" /></TableCell>
                  <TableCell><div className="h-4 w-24 shimmer rounded" /></TableCell>
                  <TableCell><div className="h-4 w-16 shimmer rounded" /></TableCell>
                  <TableCell><div className="h-4 w-16 shimmer rounded" /></TableCell>
                  <TableCell><div className="h-4 w-20 shimmer rounded" /></TableCell>
                </TableRow>
              ))
            ) : orders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-[13px]">Nenhum pedido encontrado</TableCell>
              </TableRow>
            ) : (
              orders?.map((order: any) => {
                const sp = statusPill[order.status] || statusPill.pending;
                return (
                  <TableRow key={order.id} className="border-border hover:bg-[rgba(255,255,255,0.02)] h-12">
                    <TableCell>
                      <div className="text-[13px] font-medium text-foreground">{order.customers?.name}</div>
                      <div className="text-[11px] text-muted-foreground">{order.customers?.email}</div>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{order.checkouts?.name}</TableCell>
                    <TableCell className="text-[13px] font-medium text-foreground tabular-nums">{formatCentsToBRL(order.total_amount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${sp.cls}`}>
                        {sp.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
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
