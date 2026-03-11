import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatCents } from "@/lib/formatters";
import { toast } from "sonner";

const statusBadge: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "Pendente", className: "bg-[#78350f22] text-[#fbbf24]", icon: Clock },
  sent: { label: "Enviado", className: "bg-[#28d56a18] text-[#28d56a]", icon: CheckCircle },
  failed: { label: "Falhou", className: "bg-[#ef444418] text-[#ef4444]", icon: XCircle },
};

export default function Deliveries() {
  const queryClient = useQueryClient();

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["admin-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, orders(*, customers(*)), order_items(*, products(name, price))")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const resendMutation = useMutation({
    mutationFn: async ({ orderId, orderItemId }: { orderId: string; orderItemId: string }) => {
      await supabase
        .from("deliveries")
        .update({ status: "pending" as any })
        .eq("order_item_id", orderItemId);

      const { data, error } = await supabase.functions.invoke("delivery-send", {
        body: { order_id: orderId, order_item_id: orderItemId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Entrega reenviada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-deliveries"] });
    },
    onError: (err: any) => {
      toast.error("Falha ao reenviar: " + (err.message || "Erro desconhecido"));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Entregas</h2>
        <span className="text-xs font-medium text-muted-foreground bg-[rgba(255,255,255,0.04)] px-3 py-1.5 rounded-full">
          {deliveries?.length || 0} registros
        </span>
      </div>

      <div className="card-glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[rgba(255,255,255,0.06)] hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs font-medium">Cliente</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Produto</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Telefone</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Data</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-[rgba(255,255,255,0.04)]">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-20 shimmer rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (!deliveries || deliveries.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Nenhuma entrega registrada
                </TableCell>
              </TableRow>
            ) : (
              deliveries.map((d: any) => {
                const sb = statusBadge[d.status] || statusBadge.pending;
                const StatusIcon = sb.icon;
                return (
                  <TableRow key={d.id} className="border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-150">
                    <TableCell>
                      <div className="font-medium text-foreground">{d.orders?.customers?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{d.orders?.customers?.email}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.order_items?.products?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{d.phone || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border-0 ${sb.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {sb.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {d.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.04)] text-foreground"
                          onClick={() => resendMutation.mutate({
                            orderId: d.order_id,
                            orderItemId: d.order_item_id,
                          })}
                          disabled={resendMutation.isPending}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reenviar
                        </Button>
                      )}
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
