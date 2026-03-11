import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, UserCheck, MessageSquare, TrendingUp } from "lucide-react";

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const total = data?.length || 0;
  const recovered = data?.filter((a: any) => a.recovered).length || 0;
  const whatsappSent = data?.filter((a: any) => a.whatsapp_sent_at).length || 0;
  const pending = total - recovered - whatsappSent;
  const recoveryRate = total > 0 ? ((recovered / total) * 100).toFixed(1) : "0.0";

  const statCards = [
    { title: "Abandonos Totais", value: total, icon: Users },
    { title: "Recuperados", value: recovered, icon: UserCheck },
    { title: "WhatsApp Enviado", value: whatsappSent, icon: MessageSquare },
    { title: "Taxa de Recuperação", value: `${recoveryRate}%`, icon: TrendingUp },
  ];

  const getStatus = (item: any) => {
    if (item.recovered) return { label: "Recuperado", variant: "default" as const };
    if (item.whatsapp_sent_at) return { label: "WhatsApp enviado", variant: "secondary" as const };
    return { label: "Pendente", variant: "outline" as const };
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Remarketing</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Checkout</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!data || data.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum abandono registrado
                </TableCell>
              </TableRow>
            ) : (
              data.map((item: any) => {
                const status = getStatus(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.checkouts?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{item.checkouts?.products?.name || ""}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
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
