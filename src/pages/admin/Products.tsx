import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatCentsToBRL } from "@/lib/formatters";
import { Plus, Pencil } from "lucide-react";

type ProductType = "digital" | "physical" | "service";
type DeliveryType = "whatsapp" | "email" | "none";

interface ProductForm {
  name: string;
  description: string;
  price: string; // in BRL display format
  type: ProductType;
  delivery_type: DeliveryType;
  delivery_message: string;
  delivery_attachment: string;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  type: "digital",
  delivery_type: "none",
  delivery_message: "",
  delivery_attachment: "",
};

export default function Products() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [filterType, setFilterType] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["products", filterType, page],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filterType !== "all") {
        query = query.eq("type", filterType as ProductType);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { products: data, total: count ?? 0 };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (form: ProductForm) => {
      const priceInCents = Math.round(
        parseFloat(form.price.replace(/[^\d,]/g, "").replace(",", ".")) * 100
      );

      if (isNaN(priceInCents) || priceInCents <= 0) {
        throw new Error("Preço deve ser maior que zero");
      }
      if (form.name.length < 3) {
        throw new Error("Nome deve ter pelo menos 3 caracteres");
      }

      const payload = {
        name: form.name,
        description: form.description || null,
        price: priceInCents,
        type: form.type,
        delivery_type: form.delivery_type,
        delivery_message: form.delivery_message || null,
        delivery_attachment: form.delivery_attachment || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;

        // Sync with Stripe via edge function
        try {
          await supabase.functions.invoke("sync-product", {
            body: { productId: editingId, action: "update" },
          });
        } catch (e) {
          console.warn("Stripe sync failed:", e);
        }
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        // Sync with Stripe
        try {
          await supabase.functions.invoke("sync-product", {
            body: { productId: data.id, action: "create" },
          });
        } catch (e) {
          console.warn("Stripe sync failed:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Produto atualizado!" : "Produto criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const openEdit = (product: any) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description ?? "",
      price: (product.price / 100).toFixed(2).replace(".", ","),
      type: product.type,
      delivery_type: product.delivery_type,
      delivery_message: product.delivery_message ?? "",
      delivery_attachment: product.delivery_attachment ?? "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Produtos</h2>
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="digital">Digital</SelectItem>
              <SelectItem value="physical">Físico</SelectItem>
              <SelectItem value="service">Serviço</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate(form);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Nome (mín. 3 caracteres)</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    minLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="99,90"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ProductType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="digital">Digital</SelectItem>
                        <SelectItem value="physical">Físico</SelectItem>
                        <SelectItem value="service">Serviço</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Entrega</Label>
                    <Select value={form.delivery_type} onValueChange={(v) => setForm({ ...form, delivery_type: v as DeliveryType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.delivery_type !== "none" && (
                  <div className="space-y-2">
                    <Label>Mensagem de Entrega</Label>
                    <Textarea
                      value={form.delivery_message}
                      onChange={(e) => setForm({ ...form, delivery_message: e.target.value })}
                      placeholder="Olá {{nome}}, seu acesso ao {{produto}} está pronto!"
                    />
                    <p className="text-xs text-muted-foreground">
                      Variáveis: {"{{nome}}"}, {"{{email}}"}, {"{{produto}}"}
                    </p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : data?.products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data?.products?.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{product.type}</Badge>
                    </TableCell>
                    <TableCell>{formatCentsToBRL(product.price)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={product.active}
                        onCheckedChange={(active) =>
                          toggleActive.mutate({ id: product.id, active })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {product.stripe_product_id ? (
                        <Badge variant="outline" className="text-success border-success">
                          Sincronizado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
