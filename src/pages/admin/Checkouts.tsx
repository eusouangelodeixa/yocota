import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { slugify } from "@/lib/formatters";
import { Plus, Copy, Pencil } from "lucide-react";

interface CheckoutForm {
  name: string;
  product_id: string;
  redirect_url: string;
  order_bump_product_id: string;
  checkout_slug: string;
  first_offer_id: string;
}

const emptyForm: CheckoutForm = {
  name: "",
  product_id: "",
  redirect_url: "",
  order_bump_product_id: "",
  checkout_slug: "",
  first_offer_id: "",
};

export default function Checkouts() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CheckoutForm>(emptyForm);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: checkouts, isLoading } = useQuery({
    queryKey: ["checkouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkouts")
        .select("*, products!checkouts_product_id_fkey(name, price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (form: CheckoutForm) => {
      if (!form.product_id) throw new Error("Selecione um produto");
      if (!form.redirect_url) throw new Error("URL de redirecionamento obrigatória");

      const slug = form.checkout_slug || slugify(form.name);

      const payload = {
        name: form.name,
        product_id: form.product_id,
        checkout_slug: slug,
        redirect_url: form.redirect_url,
        order_bump_product_id: form.order_bump_product_id || null,
        first_offer_id: form.first_offer_id || null,
      };

      if (editingId) {
        const { error } = await supabase.from("checkouts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("checkouts").insert(payload);
        if (error) {
          if (error.code === "23505") throw new Error("Slug já existe. Escolha outro.");
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkouts"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Checkout atualizado!" : "Checkout criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("checkouts").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checkouts"] }),
  });

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/checkout/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  const openEdit = (checkout: any) => {
    setEditingId(checkout.id);
    setForm({
      name: checkout.name,
      product_id: checkout.product_id,
      redirect_url: checkout.redirect_url,
      order_bump_product_id: checkout.order_bump_product_id ?? "",
      checkout_slug: checkout.checkout_slug,
      first_offer_id: checkout.first_offer_id ?? "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Checkouts</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Novo Checkout
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Checkout" : "Novo Checkout"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm({
                      ...form,
                      name,
                      checkout_slug: editingId ? form.checkout_slug : slugify(name),
                    });
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={form.checkout_slug}
                  onChange={(e) => setForm({ ...form, checkout_slug: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL: /checkout/{form.checkout_slug || "..."}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Produto Principal</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL de Redirecionamento (após pagamento)</Label>
                <Input
                  value={form.redirect_url}
                  onChange={(e) => setForm({ ...form, redirect_url: e.target.value })}
                  placeholder="https://exemplo.com/obrigado"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Order Bump (opcional)</Label>
                <Select
                  value={form.order_bump_product_id}
                  onValueChange={(v) => setForm({ ...form, order_bump_product_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {products
                      ?.filter((p) => p.id !== form.product_id)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primeira Oferta (Upsell/Downsell)</Label>
                <OfferSelect value={form.first_offer_id} onChange={(v) => setForm({ ...form, first_offer_id: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : checkouts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum checkout encontrado
                  </TableCell>
                </TableRow>
              ) : (
                checkouts?.map((checkout: any) => (
                  <TableRow key={checkout.id}>
                    <TableCell className="font-medium">{checkout.name}</TableCell>
                    <TableCell>{checkout.products?.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        /checkout/{checkout.checkout_slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={checkout.active}
                        onCheckedChange={(active) =>
                          toggleActive.mutate({ id: checkout.id, active })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => copyUrl(checkout.checkout_slug)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(checkout)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
