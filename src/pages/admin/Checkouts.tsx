import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { slugify, formatCents } from "@/lib/formatters";
import { Plus, Copy, Pencil, Trash2, Eye, Palette, X, GripVertical } from "lucide-react";

interface CheckoutForm {
  name: string; product_id: string; redirect_url: string; checkout_slug: string; first_offer_id: string;
  primary_color: string; accent_color: string; bg_color: string; headline_text: string; cta_text: string;
  banner_url: string; show_product_image: boolean; order_bump_product_ids: string[];
}

const emptyForm: CheckoutForm = {
  name: "", product_id: "", redirect_url: "", checkout_slug: "", first_offer_id: "",
  primary_color: "#2563eb", accent_color: "#1e40af", bg_color: "#f8fafc",
  headline_text: "", cta_text: "Finalizar compra", banner_url: "", show_product_image: true,
  order_bump_product_ids: [],
};

function OfferSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: offers } = useQuery({
    queryKey: ["offers-list"],
    queryFn: async () => { const { data, error } = await supabase.from("offers").select("id, name").order("name"); if (error) throw error; return data; },
  });
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
      <SelectContent><SelectItem value="__none__">Nenhuma</SelectItem>{offers?.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}</SelectContent>
    </Select>
  );
}

function CheckoutPreview({ form, product, bumpProducts }: { form: CheckoutForm; product: any; bumpProducts: any[] }) {
  return (
    <div className="rounded-[10px] overflow-hidden border border-border max-w-[320px] mx-auto" style={{ backgroundColor: form.bg_color }}>
      {form.banner_url && <div className="w-full h-24 overflow-hidden"><img src={form.banner_url} alt="" className="w-full h-full object-cover" /></div>}
      <div className="px-5 py-4 text-center" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.accent_color})` }}>
        <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider mb-0.5">Investimento</p>
        <div className="text-2xl font-extrabold text-white">{product ? formatCents(product.price, product.currency || "brl") : "R$ 0,00"}</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-center"><h3 className="font-bold text-sm" style={{ color: "#1a1a2e" }}>{form.headline_text || product?.name || "Nome do Produto"}</h3></div>
        <div className="space-y-2">
          {["Nome completo", "Email"].map((label) => (<div key={label}><p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p><div className="h-7 rounded-md bg-gray-100 border border-gray-200" /></div>))}
        </div>
        {bumpProducts.length > 0 && (
          <div className="space-y-2">
            {bumpProducts.map((bp) => (
              <div key={bp.id} className="rounded-lg border border-dashed border-gray-300 p-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded border border-gray-300" />
                <span className="text-[10px] font-medium text-gray-600 flex-1 truncate">{bp.name}</span>
                <span className="text-[10px] font-bold" style={{ color: form.primary_color }}>+{formatCents(bp.price, bp.currency || "brl")}</span>
              </div>
            ))}
          </div>
        )}
        <button className="w-full h-9 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: form.primary_color }}>🔒 {form.cta_text || "Finalizar compra"}</button>
      </div>
    </div>
  );
}

export default function Checkouts() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [activeTab, setActiveTab] = useState("info");

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => { const { data, error } = await supabase.from("products").select("id, name, price, currency, image_url").eq("active", true).order("name"); if (error) throw error; return data; },
  });

  const { data: checkouts, isLoading } = useQuery({
    queryKey: ["checkouts"],
    queryFn: async () => { const { data, error } = await supabase.from("checkouts").select("*, products!checkouts_product_id_fkey(name, price, currency)").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const loadBumpsForCheckout = async (checkoutId: string): Promise<string[]> => {
    const { data } = await supabase.from("checkout_order_bumps").select("product_id").eq("checkout_id", checkoutId).order("sort_order");
    return data?.map((b: any) => b.product_id) || [];
  };

  const saveMutation = useMutation({
    mutationFn: async (form: CheckoutForm) => {
      if (!form.product_id) throw new Error("Selecione um produto");
      if (!form.redirect_url) throw new Error("URL de redirecionamento obrigatória");
      const slug = form.checkout_slug || slugify(form.name);
      const payload: Record<string, any> = {
        name: form.name, product_id: form.product_id, checkout_slug: slug, redirect_url: form.redirect_url,
        order_bump_product_id: form.order_bump_product_ids[0] || null, first_offer_id: form.first_offer_id || null,
        primary_color: form.primary_color, accent_color: form.accent_color, bg_color: form.bg_color,
        headline_text: form.headline_text || null, cta_text: form.cta_text || "Finalizar compra",
        banner_url: form.banner_url || null, show_product_image: form.show_product_image,
      };
      let checkoutId: string;
      if (editingId) {
        const { error } = await supabase.from("checkouts").update(payload as any).eq("id", editingId);
        if (error) throw error;
        checkoutId = editingId;
      } else {
        const { data, error } = await supabase.from("checkouts").insert(payload as any).select("id").single();
        if (error) { if (error.code === "23505") throw new Error("Slug já existe."); throw error; }
        checkoutId = data.id;
      }
      await supabase.from("checkout_order_bumps").delete().eq("checkout_id", checkoutId);
      if (form.order_bump_product_ids.length > 0) {
        const rows = form.order_bump_product_ids.map((pid, i) => ({ checkout_id: checkoutId, product_id: pid, sort_order: i }));
        const { error: bumpError } = await supabase.from("checkout_order_bumps").insert(rows as any);
        if (bumpError) throw bumpError;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["checkouts"] }); setDialogOpen(false); setEditingId(null); setForm(emptyForm); setActiveTab("info"); toast.success(editingId ? "Checkout atualizado!" : "Checkout criado!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("checkouts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["checkouts"] }); toast.success("Checkout excluído!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from("checkouts").update({ active }).eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checkouts"] }),
  });

  const copyUrl = (slug: string) => { navigator.clipboard.writeText(`${window.location.origin}/checkout/${slug}`); toast.success("URL copiada!"); };

  const openEdit = async (checkout: any) => {
    const bumpIds = await loadBumpsForCheckout(checkout.id);
    setEditingId(checkout.id);
    setForm({ name: checkout.name, product_id: checkout.product_id, redirect_url: checkout.redirect_url, checkout_slug: checkout.checkout_slug, first_offer_id: checkout.first_offer_id ?? "", primary_color: checkout.primary_color || "#2563eb", accent_color: checkout.accent_color || "#1e40af", bg_color: checkout.bg_color || "#f8fafc", headline_text: checkout.headline_text ?? "", cta_text: checkout.cta_text || "Finalizar compra", banner_url: checkout.banner_url ?? "", show_product_image: checkout.show_product_image ?? true, order_bump_product_ids: bumpIds });
    setDialogOpen(true);
  };

  const openNew = () => { setEditingId(null); setForm(emptyForm); setActiveTab("info"); setDialogOpen(true); };

  const addBump = (productId: string) => {
    if (!productId || productId === "__none__") return;
    if (form.order_bump_product_ids.includes(productId)) { toast.error("Este produto já está como order bump"); return; }
    setForm({ ...form, order_bump_product_ids: [...form.order_bump_product_ids, productId] });
  };

  const removeBump = (productId: string) => { setForm({ ...form, order_bump_product_ids: form.order_bump_product_ids.filter((id) => id !== productId) }); };

  const selectedProduct = products?.find((p: any) => p.id === form.product_id);
  const bumpProducts = (products || []).filter((p: any) => form.order_bump_product_ids.includes(p.id));
  const availableBumpProducts = (products || []).filter((p: any) => p.id !== form.product_id && !form.order_bump_product_ids.includes(p.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Checkouts</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="h-9 bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 active:scale-[0.98] transition-all duration-150">
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} /> Novo Checkout
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-base">{editingId ? "Editar Checkout" : "Novo Checkout"}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full mb-4 bg-secondary border border-border">
                  <TabsTrigger value="info" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Informações</TabsTrigger>
                  <TabsTrigger value="design" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Palette className="mr-1.5 h-3 w-3" strokeWidth={1.5} />Personalização</TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Eye className="mr-1.5 h-3 w-3" strokeWidth={1.5} />Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Nome</Label><Input value={form.name} onChange={(e) => { const name = e.target.value; setForm({ ...form, name, checkout_slug: editingId ? form.checkout_slug : slugify(name) }); }} required /></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Slug</Label><Input value={form.checkout_slug} onChange={(e) => setForm({ ...form, checkout_slug: e.target.value })} required /><p className="text-[10px] text-muted-foreground">URL: /checkout/{form.checkout_slug || "..."}</p></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Produto Principal</Label><Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products?.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">URL Final (após pagamento e ofertas)</Label><Input value={form.redirect_url} onChange={(e) => setForm({ ...form, redirect_url: e.target.value })} placeholder="https://exemplo.com/obrigado" required /></div>
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Order Bumps</Label>
                    {bumpProducts.length > 0 && (
                      <div className="space-y-2">
                        {bumpProducts.map((bp: any, idx: number) => (
                          <div key={bp.id} className="flex items-center gap-3 rounded-lg border border-border bg-input px-3 py-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate text-foreground">{bp.name}</p><p className="text-[11px] text-muted-foreground">{formatCents(bp.price, bp.currency || "brl")}</p></div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">#{idx + 1}</Badge>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBump(bp.id)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {availableBumpProducts.length > 0 && (
                      <Select value="__none__" onValueChange={(v) => addBump(v)}><SelectTrigger><SelectValue placeholder="+ Adicionar order bump" /></SelectTrigger><SelectContent><SelectItem value="__none__" disabled>Selecione um produto</SelectItem>{availableBumpProducts.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name} — {formatCents(p.price, p.currency || "brl")}</SelectItem>))}</SelectContent></Select>
                    )}
                    {form.order_bump_product_ids.length === 0 && <p className="text-[11px] text-muted-foreground italic">Nenhum order bump adicionado.</p>}
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Primeira Oferta (Upsell/Downsell)</Label><OfferSelect value={form.first_offer_id} onChange={(v) => setForm({ ...form, first_offer_id: v })} /></div>
                </TabsContent>

                <TabsContent value="design" className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {[{ label: "Cor Primária", key: "primary_color" as const }, { label: "Cor Secundária", key: "accent_color" as const }, { label: "Cor de Fundo", key: "bg_color" as const }].map((c) => (
                      <div key={c.key} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{c.label}</Label>
                        <div className="flex gap-2 items-center"><input type="color" value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer" /><Input value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className="flex-1 text-xs" /></div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Headline</Label><Input value={form.headline_text} onChange={(e) => setForm({ ...form, headline_text: e.target.value })} placeholder="Deixe vazio para usar o nome do produto" /></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Texto do Botão (CTA)</Label><Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Finalizar compra" /></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">URL do Banner</Label><Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://exemplo.com/banner.jpg" /></div>
                  <div className="flex items-center gap-3"><Switch checked={form.show_product_image} onCheckedChange={(v) => setForm({ ...form, show_product_image: v })} /><Label className="text-xs text-muted-foreground">Mostrar imagem do produto</Label></div>
                </TabsContent>

                <TabsContent value="preview">
                  <div className="flex justify-center py-6"><CheckoutPreview form={form} product={selectedProduct} bumpProducts={bumpProducts} /></div>
                </TabsContent>
              </Tabs>
              <Button type="submit" className="w-full mt-4 h-10 bg-primary text-primary-foreground font-bold hover:brightness-110 active:scale-[0.98]" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-surface rounded-[10px] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-input">
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Nome</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Produto</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Slug</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="w-36 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (<TableRow key={i} className="border-border">{Array.from({ length: 5 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-24 shimmer rounded" /></TableCell>))}</TableRow>))
            ) : checkouts?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-[13px]">Nenhum checkout encontrado</TableCell></TableRow>
            ) : (
              checkouts?.map((checkout: any) => (
                <TableRow key={checkout.id} className="border-border hover:bg-[rgba(255,255,255,0.02)] h-12">
                  <TableCell className="text-[13px] font-medium text-foreground">{checkout.name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{checkout.products?.name}</TableCell>
                  <TableCell><code className="text-[11px] bg-secondary text-muted-foreground px-2 py-0.5 rounded font-mono">/checkout/{checkout.checkout_slug}</code></TableCell>
                  <TableCell><Switch checked={checkout.active} onCheckedChange={(active) => toggleActive.mutate({ id: checkout.id, active })} /></TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Preview" asChild><a href={`/checkout/${checkout.checkout_slug}`} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" strokeWidth={1.5} /></a></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => copyUrl(checkout.checkout_slug)} title="Copiar URL"><Copy className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(checkout)} title="Editar"><Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Excluir" onClick={() => { if (confirm("Excluir este checkout?")) deleteMutation.mutate(checkout.id); }}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
