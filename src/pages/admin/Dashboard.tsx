import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, ClipboardList, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, checkouts, orders] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("checkouts").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("orders").select("total_amount, status"),
      ]);

      const paidOrders = orders.data?.filter((o) => o.status === "paid") ?? [];
      const revenue = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);

      return {
        products: products.count ?? 0,
        checkouts: checkouts.count ?? 0,
        orders: paidOrders.length,
        revenue,
      };
    },
  });

  const cards = [
    { title: "Produtos Ativos", value: stats?.products ?? 0, icon: Package },
    { title: "Checkouts Ativos", value: stats?.checkouts ?? 0, icon: ShoppingCart },
    { title: "Pedidos Pagos", value: stats?.orders ?? 0, icon: ClipboardList },
    {
      title: "Receita Total",
      value: `R$ ${((stats?.revenue ?? 0) / 100).toFixed(2).replace(".", ",")}`,
      icon: DollarSign,
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-foreground">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
