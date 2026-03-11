import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatCents } from "@/lib/formatters";
import { toast } from "sonner";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  sent: { label: "Enviado", variant: "default", icon: CheckCircle },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
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
      // Reset delivery status to pending
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Entregas</h2>
        <Badge variant="outline" className="text-sm">
          {deliveries?.length || 0} registros
        </Badge>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!deliveries || deliveries.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma entrega registrada
                </TableCell>
              </TableRow>
            ) : (
              deliveries.map((d: any) => {
                const status = statusMap[d.status] || statusMap.pending;
                const StatusIcon = status.icon;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.orders?.customers?.name || "—"}
                      <div className="text-xs text-muted-foreground">{d.orders?.customers?.email}</div>
                    </TableCell>
                    <TableCell>{d.order_items?.products?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{d.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {d.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
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
