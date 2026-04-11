import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

const statusPill: Record<string, { label: string; cls: string }> = {
  pending: { label: "PENDENTE", cls: "pill-pending" },
  sent: { label: "ENVIADO", cls: "pill-sent" },
  failed: { label: "FALHOU", cls: "pill-failed" },
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
      const { data, error } = await supabase.functions.invoke("delivery-send", {
        body: { order_id: orderId, order_item_id: orderItemId, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Entrega reenviada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-deliveries"] });
    },
    onError: (err: any) => toast.error("Falha ao reenviar: " + (err.message || "Erro desconhecido")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Entregas</h2>
        <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
          {deliveries?.length || 0} registros
        </span>
      </div>

      <div className="card-surface rounded-[10px] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-input">
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cliente</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Produto</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Telefone</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Data</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-20 shimmer rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (!deliveries || deliveries.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-[13px]">Nenhuma entrega registrada</TableCell>
              </TableRow>
            ) : (
              deliveries.map((d: any) => {
                const sp = statusPill[d.status] || statusPill.pending;
                return (
                  <TableRow key={d.id} className="border-border hover:bg-[rgba(255,255,255,0.02)] h-12">
                    <TableCell>
                      <div className="text-[13px] font-medium text-foreground">{d.orders?.customers?.name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{d.orders?.customers?.email}</div>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{d.order_items?.products?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-[13px] text-muted-foreground">{d.phone || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${sp.cls}`}>
                        {sp.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {d.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                          onClick={() => resendMutation.mutate({ orderId: d.order_id, orderItemId: d.order_item_id })}
                          disabled={resendMutation.isPending}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" strokeWidth={1.5} />
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
