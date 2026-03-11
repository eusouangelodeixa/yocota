import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCentsToBRL } from "@/lib/formatters";

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-[#78350f22] text-[#fbbf24]" },
  paid: { label: "Pago", className: "bg-[#28d56a18] text-[#28d56a]" },
  failed: { label: "Falhou", className: "bg-[#ef444418] text-[#ef4444]" },
  refunded: { label: "Reembolso", className: "bg-[#3b82f618] text-[#60a5fa]" },
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
      <h2 className="text-2xl font-bold text-foreground">Pedidos</h2>
      <div className="card-glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[rgba(255,255,255,0.06)] hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs font-medium">Cliente</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Checkout</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Total</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-[rgba(255,255,255,0.04)]">
                  <TableCell><div className="h-4 w-32 shimmer rounded" /></TableCell>
                  <TableCell><div className="h-4 w-24 shimmer rounded" /></TableCell>
                  <TableCell><div className="h-4 w-16 shimmer rounded" /></TableCell>
                  <TableCell><div className="h-4 w-16 shimmer rounded" /></TableCell>
                  <TableCell><div className="h-4 w-20 shimmer rounded" /></TableCell>
                </TableRow>
              ))
            ) : orders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            ) : (
              orders?.map((order: any) => {
                const sb = statusBadge[order.status] || statusBadge.pending;
                return (
                  <TableRow key={order.id} className="border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-150">
                    <TableCell>
                      <div className="font-medium text-foreground">{order.customers?.name}</div>
                      <div className="text-xs text-muted-foreground">{order.customers?.email}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{order.checkouts?.name}</TableCell>
                    <TableCell className="font-medium text-foreground">{formatCentsToBRL(order.total_amount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border-0 ${sb.className}`}>
                        {sb.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
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
