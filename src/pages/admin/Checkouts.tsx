import { useState, useEffect, useRef } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { slugify, formatCents } from "@/lib/formatters";
import { Plus, Copy, Pencil, Trash2, Eye, Palette, X, GripVertical, Upload, ImageIcon, Loader2, Zap, Users } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface CheckoutForm {
  name: string; product_id: string; redirect_url: string; checkout_slug: string; first_offer_id: string;
  primary_color: string; accent_color: string; bg_color: string; headline_text: string; cta_text: string;
  banner_url: string; show_product_image: boolean; order_bump_product_ids: string[];
  order_bump_descriptions: Record<string, string>;
  countdown_enabled: boolean; countdown_duration: number; countdown_text: string;
  countdown_bg_color: string; countdown_text_color: string;
  social_proof_enabled: boolean; social_proof_messages: string; social_proof_interval: number;
  social_proof_display_duration: number; social_proof_position: string;
}

const emptyForm: CheckoutForm = {
  name: "", product_id: "", redirect_url: "", checkout_slug: "", first_offer_id: "",
  primary_color: "#2563eb", accent_color: "#1e40af", bg_color: "#f8fafc",
  headline_text: "", cta_text: "Finalizar compra", banner_url: "", show_product_image: true,
  order_bump_product_ids: [], order_bump_descriptions: {},
  countdown_enabled: false, countdown_duration: 10, countdown_text: "Essa oferta expira em:",
  countdown_bg_color: "#dc2626", countdown_text_color: "#ffffff",
  social_proof_enabled: false, social_proof_messages: "", social_proof_interval: 15,
  social_proof_display_duration: 5, social_proof_position: "bottom-left",
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

/* ── Banner Upload ── */
function BannerUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(fileName);
      onChange(publicUrl.publicUrl);
      toast.success("Banner enviado!");
    } catch (err: any) { toast.error("Erro ao enviar banner: " + err.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">Banner</Label>
      {value ? (
        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border bg-input">
          <img src={value} alt="Banner" className="w-full h-full object-cover" />
          <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => onChange("")}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 rounded-lg border border-dashed border-border bg-input hover:border-primary/30 hover:bg-secondary/50 transition-all duration-150 flex flex-col items-center justify-center gap-2 text-muted-foreground"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" strokeWidth={1.5} />}
          <span className="text-[11px]">{uploading ? "Enviando..." : "Clique para fazer upload do banner"}</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}

/* ── Checkout Live Preview (faithful recreation) ── */
function CheckoutLivePreview({ form, product, bumpProducts }: { form: CheckoutForm; product: any; bumpProducts: any[] }) {
  const currency = product?.currency || "eur";

  return (
    <div className="w-full bg-[#09090b] rounded-[10px] border border-border overflow-hidden">
      <div className="flex flex-col lg:flex-row min-h-[480px]">
        {/* Left panel */}
        <div className="lg:w-[45%] bg-[#111113] border-b lg:border-b-0 lg:border-r border-[#27272a] p-6 lg:p-8 flex flex-col justify-center">
          <div className="max-w-sm">
            {form.banner_url && (
              <div className="w-full h-28 rounded-lg overflow-hidden mb-4 border border-[#27272a]">
                <img src={form.banner_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <h3 className="text-base font-semibold text-[#fafafa] mb-1">{form.headline_text || product?.name || "Nome do Produto"}</h3>
            {product?.description && <p className="text-xs text-[#71717a] leading-relaxed mb-4">{product.description}</p>}
            <div className="text-2xl font-bold text-[#fafafa] tabular-nums mb-4">{product ? formatCents(product.price, currency) : "€ 0,00"}</div>
            <div className="border-t border-[#27272a]" />

            {bumpProducts.length > 0 && (
              <div className="mt-4 space-y-2">
                {bumpProducts.map((bp) => (
                  <div key={bp.id} className="rounded-[10px] border border-[#27272a] bg-[#18181b] p-3 flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded border border-[#27272a]" />
                    <span className="text-[11px] font-medium text-[#fafafa] flex-1 truncate">{bp.name}</span>
                    <span className="text-[11px] font-bold text-primary tabular-nums">+{formatCents(bp.price, bp.currency || currency)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#27272a] flex justify-between items-center">
              <span className="text-xs text-[#a1a1aa]">Total</span>
              <span className="text-lg font-bold text-[#fafafa] tabular-nums">{product ? formatCents(product.price, currency) : "€ 0,00"}</span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 p-6 lg:p-8 flex flex-col justify-center">
          <div className="max-w-sm mx-auto w-full">
            <p className="text-[10px] uppercase tracking-wider text-[#52525b] font-medium mb-4">Informações de pagamento</p>
            <div className="space-y-3">
              {["Nome completo", "Email", "WhatsApp"].map((label) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] font-medium text-[#a1a1aa]">{label}</p>
                  <div className="h-10 rounded-lg bg-[#111113] border border-[#27272a]" />
                </div>
              ))}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-[#a1a1aa]">Dados do cartão</p>
                <div className="h-10 rounded-lg bg-[#111113] border border-[#27272a]" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-10 rounded-lg bg-[#111113] border border-[#27272a]" />
                  <div className="h-10 rounded-lg bg-[#111113] border border-[#27272a]" />
                </div>
              </div>
              <button className="w-full h-11 font-bold text-xs rounded-lg cursor-default flex items-center justify-center gap-1.5" style={{ backgroundColor: form.primary_color || '#2563eb', color: '#fff' }}>
                🔒 {form.cta_text || "Finalizar compra"} {product ? formatCents(product.price, currency) : ""}
              </button>
              <p className="text-[10px] text-[#52525b] text-center">🔒 Pagamento processado com segurança via Stripe</p>
            </div>
          </div>
        </div>
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
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => { const { data, error } = await supabase.from("products").select("id, name, price, currency, image_url, description").eq("active", true).order("name"); if (error) throw error; return data; },
  });

  const { data: checkouts, isLoading } = useQuery({
    queryKey: ["checkouts"],
    queryFn: async () => { const { data, error } = await supabase.from("checkouts").select("*, products!checkouts_product_id_fkey(name, price, currency, description, image_url)").order("created_at", { ascending: false }); if (error) throw error; return data; },
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
        countdown_enabled: form.countdown_enabled, countdown_duration: form.countdown_duration,
        countdown_text: form.countdown_text, countdown_bg_color: form.countdown_bg_color,
        countdown_text_color: form.countdown_text_color, social_proof_enabled: form.social_proof_enabled,
        social_proof_messages: form.social_proof_messages.split("\n").map(s => s.trim()).filter(Boolean),
        social_proof_interval: form.social_proof_interval, social_proof_display_duration: form.social_proof_display_duration,
        social_proof_position: form.social_proof_position,
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
    const spMessages = Array.isArray(checkout.social_proof_messages) ? (checkout.social_proof_messages as string[]).join("\n") : "";
    setForm({ name: checkout.name, product_id: checkout.product_id, redirect_url: checkout.redirect_url, checkout_slug: checkout.checkout_slug, first_offer_id: checkout.first_offer_id ?? "", primary_color: checkout.primary_color || "#2563eb", accent_color: checkout.accent_color || "#1e40af", bg_color: checkout.bg_color || "#f8fafc", headline_text: checkout.headline_text ?? "", cta_text: checkout.cta_text || "Finalizar compra", banner_url: checkout.banner_url ?? "", show_product_image: checkout.show_product_image ?? true, order_bump_product_ids: bumpIds, countdown_enabled: checkout.countdown_enabled ?? false, countdown_duration: checkout.countdown_duration ?? 10, countdown_text: checkout.countdown_text ?? "Essa oferta expira em:", countdown_bg_color: checkout.countdown_bg_color ?? "#dc2626", countdown_text_color: checkout.countdown_text_color ?? "#ffffff", social_proof_enabled: checkout.social_proof_enabled ?? false, social_proof_messages: spMessages, social_proof_interval: checkout.social_proof_interval ?? 15, social_proof_display_duration: checkout.social_proof_display_duration ?? 5, social_proof_position: checkout.social_proof_position ?? "bottom-left" });
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
           <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
             <DialogHeader><DialogTitle className="text-base">{editingId ? "Editar Checkout" : "Novo Checkout"}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full mb-4 bg-secondary border border-border">
                  <TabsTrigger value="info" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Info</TabsTrigger>
                  <TabsTrigger value="design" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Palette className="mr-1 h-3 w-3" strokeWidth={1.5} />Design</TabsTrigger>
                  <TabsTrigger value="conversion" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Zap className="mr-1 h-3 w-3" strokeWidth={1.5} />Conversão</TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Eye className="mr-1 h-3 w-3" strokeWidth={1.5} />Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Nome</Label><Input value={form.name} onChange={(e) => { const name = e.target.value; setForm({ ...form, name, checkout_slug: editingId ? form.checkout_slug : slugify(name) }); }} required /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Slug</Label><Input value={form.checkout_slug} onChange={(e) => setForm({ ...form, checkout_slug: e.target.value })} required /><p className="text-[10px] text-muted-foreground">URL: /checkout/{form.checkout_slug || "..."}</p></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Produto Principal</Label><Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products?.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">URL Final (após pagamento)</Label><Input value={form.redirect_url} onChange={(e) => setForm({ ...form, redirect_url: e.target.value })} placeholder="https://exemplo.com/obrigado" required /></div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Order Bumps</Label>
                    {bumpProducts.length > 0 && (
                      <div className="space-y-2">
                        {bumpProducts.map((bp: any, idx: number) => (
                          <div key={bp.id} className="flex items-center gap-3 rounded-lg border border-border bg-input px-3 py-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate text-foreground">{bp.name}</p><p className="text-[11px] text-muted-foreground">{formatCents(bp.price, bp.currency || "eur")}</p></div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">#{idx + 1}</Badge>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBump(bp.id)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {availableBumpProducts.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full justify-start text-muted-foreground text-xs h-10">
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar order bump
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-1 max-h-60 overflow-y-auto" align="start" side="bottom">
                          {availableBumpProducts.map((p: any) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-[13px] rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex justify-between items-center gap-2"
                              onClick={() => { addBump(p.id); }}
                            >
                              <span className="truncate">{p.name}</span>
                              <span className="text-[11px] text-muted-foreground shrink-0">{formatCents(p.price, p.currency || "eur")}</span>
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                    {form.order_bump_product_ids.length === 0 && <p className="text-[11px] text-muted-foreground italic">Nenhum order bump adicionado.</p>}
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Primeira Oferta (Upsell/Downsell)</Label><OfferSelect value={form.first_offer_id} onChange={(v) => setForm({ ...form, first_offer_id: v })} /></div>
                </TabsContent>

                <TabsContent value="design" className="space-y-4">
                  <BannerUpload value={form.banner_url} onChange={(url) => setForm({ ...form, banner_url: url })} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[{ label: "Cor Primária", key: "primary_color" as const }, { label: "Cor Secundária", key: "accent_color" as const }, { label: "Cor de Fundo", key: "bg_color" as const }].map((c) => (
                      <div key={c.key} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{c.label}</Label>
                        <div className="flex gap-2 items-center"><input type="color" value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" /><Input value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className="flex-1 text-xs" /></div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Headline</Label><Input value={form.headline_text} onChange={(e) => setForm({ ...form, headline_text: e.target.value })} placeholder="Deixe vazio para usar o nome do produto" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Texto do Botão (CTA)</Label><Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Finalizar compra" /></div>
                  </div>
                  <div className="flex items-center gap-3"><Switch checked={form.show_product_image} onCheckedChange={(v) => setForm({ ...form, show_product_image: v })} /><Label className="text-xs text-muted-foreground">Mostrar imagem do produto</Label></div>
                </TabsContent>

                <TabsContent value="conversion" className="space-y-6">
                  {/* Countdown Bar */}
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" strokeWidth={1.5} />
                        <Label className="text-sm font-semibold text-foreground">Barra de Urgência</Label>
                      </div>
                      <Switch checked={form.countdown_enabled} onCheckedChange={(v) => setForm({ ...form, countdown_enabled: v })} />
                    </div>
                    {form.countdown_enabled && (
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Texto da barra</Label><Input value={form.countdown_text} onChange={(e) => setForm({ ...form, countdown_text: e.target.value })} /></div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Duração (minutos)</Label><Input type="number" min={1} max={120} value={form.countdown_duration} onChange={(e) => setForm({ ...form, countdown_duration: parseInt(e.target.value) || 10 })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Cor de fundo</Label>
                            <div className="flex gap-2 items-center"><input type="color" value={form.countdown_bg_color} onChange={(e) => setForm({ ...form, countdown_bg_color: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" /><Input value={form.countdown_bg_color} onChange={(e) => setForm({ ...form, countdown_bg_color: e.target.value })} className="flex-1 text-xs" /></div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Cor do texto</Label>
                            <div className="flex gap-2 items-center"><input type="color" value={form.countdown_text_color} onChange={(e) => setForm({ ...form, countdown_text_color: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" /><Input value={form.countdown_text_color} onChange={(e) => setForm({ ...form, countdown_text_color: e.target.value })} className="flex-1 text-xs" /></div>
                          </div>
                        </div>
                        <div className="rounded-lg overflow-hidden border border-border">
                          <div className="py-2 px-4 flex items-center justify-center gap-2 text-sm font-semibold" style={{ backgroundColor: form.countdown_bg_color, color: form.countdown_text_color }}>
                            <Zap className="h-4 w-4" /><span>{form.countdown_text}</span><span className="tabular-nums font-bold text-base">09:58</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Social Proof */}
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" strokeWidth={1.5} />
                        <Label className="text-sm font-semibold text-foreground">Prova Social</Label>
                      </div>
                      <Switch checked={form.social_proof_enabled} onCheckedChange={(v) => setForm({ ...form, social_proof_enabled: v })} />
                    </div>
                    {form.social_proof_enabled && (
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Mensagens (uma por linha: Nome - Cidade)</Label>
                          <Textarea value={form.social_proof_messages} onChange={(e) => setForm({ ...form, social_proof_messages: e.target.value })} placeholder={"Maria - São Paulo\nCarlos - Rio de Janeiro\nJuliana - Belo Horizonte"} rows={5} className="text-xs" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Intervalo (seg)</Label><Input type="number" min={5} max={120} value={form.social_proof_interval} onChange={(e) => setForm({ ...form, social_proof_interval: parseInt(e.target.value) || 15 })} /></div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Exibição (seg)</Label><Input type="number" min={2} max={30} value={form.social_proof_display_duration} onChange={(e) => setForm({ ...form, social_proof_display_duration: parseInt(e.target.value) || 5 })} /></div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Posição</Label><Select value={form.social_proof_position} onValueChange={(v) => setForm({ ...form, social_proof_position: v })}><SelectTrigger className="text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bottom-left">Inferior esquerdo</SelectItem><SelectItem value="bottom-right">Inferior direito</SelectItem></SelectContent></Select></div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="preview">
                  <div className="py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Preview em tempo real</p>
                    <CheckoutLivePreview form={form} product={selectedProduct} bumpProducts={bumpProducts} />
                  </div>
                </TabsContent>
              </Tabs>
              <Button type="submit" className="w-full mt-4 h-10 bg-primary text-primary-foreground font-bold hover:brightness-110 active:scale-[0.98]" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Preview Sheet */}
      <Sheet open={!!previewSlug} onOpenChange={(open) => !open && setPreviewSlug(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[800px] p-0 bg-background border-border">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="text-sm font-semibold">Preview do Checkout</SheetTitle>
          </SheetHeader>
          <div className="w-full h-[calc(100vh-56px)]">
            {previewSlug && (
              <iframe
                src={`/checkout/${previewSlug}`}
                className="w-full h-full border-0"
                title="Checkout Preview"
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className="card-surface rounded-[10px] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-input">
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Nome</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Produto</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Slug</TableHead>
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
                  <TableCell className="text-[13px] text-muted-foreground hidden sm:table-cell">{checkout.products?.name}</TableCell>
                  <TableCell className="hidden md:table-cell"><code className="text-[11px] bg-secondary text-muted-foreground px-2 py-0.5 rounded font-mono">/checkout/{checkout.checkout_slug}</code></TableCell>
                  <TableCell><Switch checked={checkout.active} onCheckedChange={(active) => toggleActive.mutate({ id: checkout.id, active })} /></TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Preview" onClick={() => setPreviewSlug(checkout.checkout_slug)}><Eye className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>
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
