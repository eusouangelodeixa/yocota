import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatCents, getCurrencyLabel, SUPPORTED_CURRENCIES, parsePriceToCents, isZeroDecimalCurrency } from "@/lib/formatters";
import { Plus, Pencil, Upload, X, ImageIcon } from "lucide-react";

type ProductType = "digital" | "physical" | "service";
type DeliveryType = "whatsapp" | "email" | "none";

interface ProductForm {
  name: string;
  description: string;
  price: string;
  currency: string;
  type: ProductType;
  delivery_type: DeliveryType;
  delivery_message: string;
  delivery_attachment: string;
  image_url: string;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  currency: "brl",
  type: "digital",
  delivery_type: "none",
  delivery_message: "",
  delivery_attachment: "",
  image_url: "",
};

function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      onChange(publicUrl.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">Imagem do Produto</Label>
      {value ? (
        <div className="relative w-full h-32 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
          <img src={value} alt="Produto" className="w-full h-full object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          className="w-full h-32 rounded-xl border border-dashed border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 transition-colors duration-150"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <p className="text-xs text-muted-foreground animate-pulse">Enviando...</p>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Clique para enviar imagem</p>
              <p className="text-[10px] text-[#555555]">PNG, JPG até 5MB</p>
            </>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}

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
      const priceInCents = parsePriceToCents(form.price, form.currency);

      if (isNaN(priceInCents) || priceInCents <= 0) {
        throw new Error("Preço deve ser maior que zero");
      }
      if (form.name.length < 3) {
        throw new Error("Nome deve ter pelo menos 3 caracteres");
      }

      const payload: Record<string, any> = {
        name: form.name,
        description: form.description || null,
        price: priceInCents,
        currency: form.currency,
        type: form.type,
        delivery_type: form.delivery_type,
        delivery_message: form.delivery_message || null,
        delivery_attachment: form.delivery_attachment || null,
        image_url: form.image_url || null,
      };

      if (editingId) {
        const { error } = await supabase.from("products").update(payload as any).eq("id", editingId);
        if (error) throw error;

        try {
          await supabase.functions.invoke("sync-product", {
            body: { productId: editingId, action: "update" },
          });
        } catch (e) {
          console.warn("Stripe sync failed:", e);
        }
      } else {
        const { data, error } = await supabase.from("products").insert(payload as any).select().single();
        if (error) throw error;

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
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const openEdit = (product: any) => {
    setEditingId(product.id);
    const currency = product.currency || "brl";
    const decimals = isZeroDecimalCurrency(currency) ? 0 : 2;
    setForm({
      name: product.name,
      description: product.description ?? "",
      price: (product.price / Math.pow(10, decimals)).toFixed(decimals).replace(".", ","),
      currency,
      type: product.type,
      delivery_type: product.delivery_type,
      delivery_message: product.delivery_message ?? "",
      delivery_attachment: product.delivery_attachment ?? "",
      image_url: product.image_url ?? "",
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
              <Button onClick={openNew} className="bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all duration-150">
                <Plus className="mr-2 h-4 w-4" /> Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} />

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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>{getCurrencyLabel(c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Preço</Label>
                    <Input
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder={isZeroDecimalCurrency(form.currency) ? "1000" : "99,90"}
                      required
                    />
                    {isZeroDecimalCurrency(form.currency) && (
                      <p className="text-xs text-muted-foreground">Moeda sem centavos</p>
                    )}
                  </div>
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
                  <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Configuração de Entrega
                    </p>
                    <div className="space-y-2">
                      <Label>Mensagem de Entrega</Label>
                      <Textarea
                        value={form.delivery_message}
                        onChange={(e) => setForm({ ...form, delivery_message: e.target.value })}
                        placeholder="Olá {{nome}}, seu acesso ao {{produto}} está pronto! Clique no link abaixo:"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Variáveis: {"{{nome}}"}, {"{{email}}"}, {"{{produto}}"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Link / Anexo de Entrega</Label>
                      <Input
                        value={form.delivery_attachment}
                        onChange={(e) => setForm({ ...form, delivery_attachment: e.target.value })}
                        placeholder="https://seusite.com/acesso ou link de download"
                      />
                      <p className="text-xs text-muted-foreground">
                        URL do produto, link de acesso, arquivo para download, etc. Será enviado junto com a mensagem.
                      </p>
                    </div>
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

      <div className="card-glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[rgba(255,255,255,0.06)] hover:bg-transparent">
              <TableHead className="w-12"></TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Nome</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Tipo</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Preço</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Stripe</TableHead>
              <TableHead className="w-24 text-muted-foreground text-xs font-medium">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 justify-center">
                          <div className="h-10 w-10 shimmer rounded-lg" />
                          <div className="h-4 w-40 shimmer rounded" />
                          <div className="h-4 w-16 shimmer rounded" />
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ) : data?.products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data?.products?.map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{product.type}</Badge>
                    </TableCell>
                    <TableCell>{formatCents(product.price, product.currency || "brl")}</TableCell>
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
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
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
