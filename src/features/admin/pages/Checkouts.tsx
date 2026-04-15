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
import { Plus, Copy, Pencil, Trash2, Eye, Palette, X, GripVertical, Upload, ImageIcon, Loader2, Zap, Users, ChevronDown, Lock, User, Mail, Shield, ShoppingCart, Phone, CreditCard, CheckCircle2, ScanLine } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface CheckoutForm {
  name: string; product_id: string; redirect_url: string; checkout_slug: string; first_offer_id: string;
  primary_color: string; accent_color: string; bg_color: string; cta_button_color: string; headline_text: string; cta_text: string;
  banner_url: string; show_product_image: boolean; order_bump_product_ids: string[];
  order_bump_descriptions: Record<string, string>;
  countdown_enabled: boolean; countdown_duration: number; countdown_text: string; countdown_expired_text: string;
  countdown_bg_color: string; countdown_text_color: string;
  social_proof_enabled: boolean; social_proof_messages: string; social_proof_interval: number;
  social_proof_display_duration: number; social_proof_position: string;
  // Tracking Pixels
  fb_pixel_id: string; tiktok_pixel_id: string;
  google_ads_id: string; google_ads_label: string; gtm_id: string;
}

const emptyForm: CheckoutForm = {
  name: "", product_id: "", redirect_url: "", checkout_slug: "", first_offer_id: "",
  primary_color: "#2563eb", accent_color: "#1e40af", bg_color: "#f8fafc", cta_button_color: "",
  headline_text: "", cta_text: "Finalizar compra", banner_url: "", show_product_image: true,
  order_bump_product_ids: [], order_bump_descriptions: {},
  countdown_enabled: false, countdown_duration: 10, countdown_text: "Tempo a esgotar. Desconto expira em:",
  countdown_expired_text: "O tempo acabou mas ainda podes comprar!",
  countdown_bg_color: "#dc2626", countdown_text_color: "#ffffff",
  social_proof_enabled: false, social_proof_messages: "", social_proof_interval: 15,
  social_proof_display_duration: 5, social_proof_position: "bottom-left",
  fb_pixel_id: "", tiktok_pixel_id: "", google_ads_id: "", google_ads_label: "", gtm_id: "",
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

/* ── Faithful 1:1 Checkout Preview ── */
function CheckoutLivePreview({ form, product, bumpProducts }: { form: CheckoutForm; product: any; bumpProducts: any[] }) {
  const isMZN = (product?.currency || "eur").toUpperCase() === "MZN";
  const currency = product?.currency || "eur";
  const btnColor = form.cta_button_color || form.primary_color || "#00B589";
  const bgColor  = form.bg_color || "#f9fafb";

  const basePrice = product ? formatCents(product.price, currency) : "—";

  const labelClass = "block text-[12px] font-semibold text-[#1F2937] mb-1";
  const fieldWrap  = "relative flex items-center h-10 rounded-lg border border-[#D1D5DB] bg-white overflow-hidden";
  const fieldMock  = "flex-1 h-full px-2 text-[13px] text-[#9CA3AF] bg-transparent outline-none";

  return (
    <div className="w-full rounded-2xl border border-border overflow-hidden font-sans" style={{ backgroundColor: bgColor }}>

      {/* Countdown bar */}
      {form.countdown_enabled && (
        <div className="py-2 px-4 flex items-center justify-center gap-2 text-[11px] font-bold"
          style={{ backgroundColor: form.countdown_bg_color || "#dc2626", color: form.countdown_text_color || "#ffffff" }}>
          <Zap className="h-3 w-3 shrink-0" />
          <span className="truncate">{form.countdown_text || "Oferta expira em:"}</span>
          <span className="tabular-nums shrink-0">09:58</span>
        </div>
      )}

      <div className="px-4 pt-4 pb-5 space-y-3">

        {/* Banner */}
        {form.banner_url && (
          <div className="w-full rounded-2xl overflow-hidden shadow-sm">
            <img src={form.banner_url} className="w-full h-auto object-cover" alt="" />
          </div>
        )}

        {/* Headline centrada */}
        <div className="text-center pt-1 pb-0.5">
          <h1 className="text-[15px] font-extrabold text-[#111827] leading-snug">
            {form.headline_text || product?.name || "Nome do Produto"}
          </h1>
        </div>

        {/* Product Summary Card — centrado */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm px-3 py-3 flex flex-col items-center gap-2 text-center">
          {form.show_product_image && product?.image_url && (
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#F3F4F6]">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <p className="text-[13px] font-bold text-[#1F2937] leading-snug line-clamp-2">
              {product?.name || "Nome do Produto"}
            </p>
            <p className="text-[20px] font-extrabold leading-tight mt-0.5" style={{ color: btnColor }}>
              {basePrice}
            </p>
          </div>
          {isMZN && <span className="text-lg select-none">🇲🇿</span>}
        </div>

        {/* Nome completo */}
        <div>
          <label className={labelClass}>Nome completo <span className="text-[#EF4444]">*</span></label>
          <div className={fieldWrap}>
            <span className="pl-2.5 pr-1.5 text-[#9CA3AF] flex-shrink-0"><User className="h-4 w-4" strokeWidth={1.5} /></span>
            <span className={fieldMock}>Nome completo</span>
          </div>
        </div>

        {/* Email */}
        <div>
          <label className={labelClass}>Email <span className="text-[#6B7280] font-normal text-[10px]">(opcional)</span></label>
          <div className={fieldWrap}>
            <span className="pl-2.5 pr-1.5 text-[#9CA3AF] flex-shrink-0"><Mail className="h-4 w-4" strokeWidth={1.5} /></span>
            <span className={fieldMock}>seu@email.com</span>
          </div>
        </div>

        {/* WhatsApp */}
        <div>
          <label className={labelClass}>WhatsApp <span className="text-[#EF4444]">*</span></label>
          <div className={fieldWrap}>
            <span className="pl-2.5 pr-1.5 flex-shrink-0">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </span>
            {isMZN ? (
              <>
                <span className="text-[12px] font-semibold text-[#1F2937] pr-2 border-r border-[#E5E7EB] mr-1">+258</span>
                <span className={fieldMock}>84 123 4567</span>
              </>
            ) : (
              <>
                <span className="text-[12px] font-semibold text-[#1F2937] pr-2 border-r border-[#E5E7EB] mr-1 flex items-center gap-1">🇵🇹 +351 <ChevronDown className="h-3 w-3" /></span>
                <span className={fieldMock}>912 345 678</span>
              </>
            )}
          </div>
        </div>

        {/* Order Bumps */}
        {bumpProducts.length > 0 && (
          <div className="space-y-2">
            <label className={labelClass}>Ofertas especiais</label>
            {bumpProducts.map((bp) => (
              <div key={bp.id} className="p-3 rounded-xl border-2 border-[#D1D5DB] bg-white flex items-start gap-3">
                <div className="w-5 h-5 rounded border-2 border-[#D1D5DB] bg-white shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[13px] font-semibold text-[#1F2937] leading-tight">{bp.name}</span>
                    <span className="text-[12px] font-semibold text-[#1F2937] shrink-0">+{formatCents(bp.price, bp.currency)}</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-0.5 line-clamp-2">{form.order_bump_descriptions[bp.id] || bp.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment */}
        {isMZN ? (
          <div className="space-y-2">
            <label className={labelClass}>Selecione o método de pagamento <span className="text-[#EF4444]">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col items-center p-2 rounded-lg border-2 border-[#22C55E] bg-[#F0FDF4] gap-1">
                <div className="flex items-center gap-1.5 w-full">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-[#3B82F6] bg-[#3B82F6] flex items-center justify-center flex-shrink-0">
                    <div className="w-1 h-1 rounded-full bg-white" />
                  </div>
                  <img src="/assets/emola-logo.png" className="h-5 object-contain flex-1" alt="e-Mola" />
                </div>
                <span className="text-[10px] font-medium text-[#1F2937]">e-Mola</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg border-2 border-[#D1D5DB] bg-white gap-1">
                <div className="flex items-center gap-1.5 w-full">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-[#D1D5DB] flex-shrink-0" />
                  <img src="/assets/mpesa-logo.png" className="h-5 object-contain flex-1" alt="M-Pesa" />
                </div>
                <span className="text-[10px] font-medium text-[#1F2937]">M-Pesa</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Número e-Mola <span className="text-[#EF4444]">*</span></label>
              <div className={fieldWrap}>
                <span className="pl-2.5 pr-1.5 text-[#9CA3AF] flex-shrink-0"><Phone className="h-4 w-4" strokeWidth={1.5} /></span>
                <span className="text-[12px] font-semibold text-[#1F2937] pr-2 border-r border-[#E5E7EB] mr-1">+258</span>
                <span className={fieldMock}>86 12 34 567</span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className={labelClass}><CreditCard className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Cartão de crédito <span className="text-[#EF4444]">*</span></label>
            <div className="space-y-2">
              <div className="flex items-center h-10 rounded-lg border border-[#D1D5DB] bg-white px-3">
                <span className="text-[13px] text-[#9CA3AF]">1234 5678 9012 3456</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center h-10 rounded-lg border border-[#D1D5DB] bg-white px-3">
                  <span className="text-[13px] text-[#9CA3AF]">MM/AA</span>
                </div>
                <div className="flex items-center h-10 rounded-lg border border-[#D1D5DB] bg-white px-3">
                  <span className="text-[13px] text-[#9CA3AF]">CVV</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA Button — centrado com sombra */}
        <div className="pt-1 space-y-2">
          <div className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 shadow-md"
            style={{ backgroundColor: btnColor }}>
            <ShoppingCart size={18} className="text-white" strokeWidth={2} />
            <span className="text-white font-bold text-[14px]">{form.cta_text || "Finalizar Compra"} — {basePrice}</span>
          </div>
          {/* Trust badges — centralizados */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-[#6B7280]">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-[#22C55E]" strokeWidth={2} /> Compra 100% segura
            </span>
            <span className="text-[#D1D5DB]">|</span>
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-[#22C55E]" strokeWidth={2} /> Entrega imediata
            </span>
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
  const [bumpPickerOpen, setBumpPickerOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => { const { data, error } = await supabase.from("products").select("id, name, price, currency, image_url, description").eq("active", true).order("name"); if (error) throw error; return data; },
  });

  const { data: checkouts, isLoading } = useQuery({
    queryKey: ["checkouts"],
    queryFn: async () => { const { data, error } = await supabase.from("checkouts").select("*, products!checkouts_product_id_fkey(name, price, currency, description, image_url)").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const loadBumpsForCheckout = async (checkoutId: string): Promise<{ ids: string[]; descriptions: Record<string, string> }> => {
    const { data } = await supabase.from("checkout_order_bumps").select("product_id, description").eq("checkout_id", checkoutId).order("sort_order");
    const ids = data?.map((b: any) => b.product_id) || [];
    const descriptions: Record<string, string> = {};
    data?.forEach((b: any) => { if (b.description) descriptions[b.product_id] = b.description; });
    return { ids, descriptions };
  };

  const saveMutation = useMutation({
    mutationFn: async (form: CheckoutForm) => {
      if (!form.product_id) throw new Error("Selecione um produto");
      if (!form.redirect_url) throw new Error("URL de redirecionamento obrigatória");
      const slug = form.checkout_slug || slugify(form.name);
      const payload: Record<string, any> = {
        name: form.name, product_id: form.product_id, checkout_slug: slug, redirect_url: form.redirect_url,
        order_bump_product_id: form.order_bump_product_ids[0] || null, first_offer_id: form.first_offer_id || null,
        primary_color: form.primary_color, accent_color: form.accent_color, bg_color: form.bg_color, cta_button_color: form.cta_button_color || null,
        headline_text: form.headline_text || null, cta_text: form.cta_text || "Finalizar compra",
        banner_url: form.banner_url || null, show_product_image: form.show_product_image,
        countdown_enabled: form.countdown_enabled, countdown_duration: form.countdown_duration,
        countdown_text: form.countdown_text, countdown_expired_text: form.countdown_expired_text,
        countdown_bg_color: form.countdown_bg_color,
        countdown_text_color: form.countdown_text_color, social_proof_enabled: form.social_proof_enabled,
        social_proof_messages: form.social_proof_messages.split("\n").map(s => s.trim()).filter(Boolean),
        social_proof_interval: form.social_proof_interval, social_proof_display_duration: form.social_proof_display_duration,
        social_proof_position: form.social_proof_position,
        fb_pixel_id: form.fb_pixel_id || null,
        tiktok_pixel_id: form.tiktok_pixel_id || null,
        google_ads_id: form.google_ads_id || null,
        google_ads_label: form.google_ads_label || null,
        gtm_id: form.gtm_id || null,
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
        const rows = form.order_bump_product_ids.map((pid, i) => ({ checkout_id: checkoutId, product_id: pid, sort_order: i, description: form.order_bump_descriptions[pid] || null }));
        const { error: bumpError } = await supabase.from("checkout_order_bumps").insert(rows as any);
        if (bumpError) throw bumpError;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["checkouts"] }); setDialogOpen(false); setEditingId(null); setForm(emptyForm); setActiveTab("info"); setBumpPickerOpen(false); toast.success(editingId ? "Checkout atualizado!" : "Checkout criado!"); },
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
    const { ids: bumpIds, descriptions: bumpDescs } = await loadBumpsForCheckout(checkout.id);
    setEditingId(checkout.id);
    const spMessages = Array.isArray(checkout.social_proof_messages) ? (checkout.social_proof_messages as string[]).join("\n") : "";
    setForm({ 
      name: checkout.name, 
      product_id: checkout.product_id, 
      redirect_url: checkout.redirect_url, 
      checkout_slug: checkout.checkout_slug, 
      first_offer_id: checkout.first_offer_id ?? "", 
      primary_color: checkout.primary_color || "#2563eb", 
      accent_color: checkout.accent_color || "#1e40af", 
      bg_color: checkout.bg_color || "#ffffff", 
      cta_button_color: checkout.cta_button_color || "", 
      headline_text: checkout.headline_text ?? "", 
      cta_text: checkout.cta_text || "Finalizar compra", 
      banner_url: checkout.banner_url ?? "", 
      show_product_image: checkout.show_product_image ?? true, 
      order_bump_product_ids: bumpIds, 
      order_bump_descriptions: bumpDescs, 
      countdown_enabled: checkout.countdown_enabled ?? false, 
      countdown_duration: checkout.countdown_duration ?? 10, 
      countdown_text: checkout.countdown_text ?? "Tempo a esgotar. Desconto expira em:", 
      countdown_expired_text: checkout.countdown_expired_text ?? "O tempo acabou mas ainda podes comprar!",
      countdown_bg_color: checkout.countdown_bg_color ?? "#dc2626", 
      countdown_text_color: checkout.countdown_text_color ?? "#ffffff", 
      social_proof_enabled: checkout.social_proof_enabled ?? false, 
      social_proof_messages: spMessages, 
      social_proof_interval: checkout.social_proof_interval ?? 15, 
      social_proof_display_duration: checkout.social_proof_display_duration ?? 5, 
      social_proof_position: checkout.social_proof_position ?? "bottom-left",
      fb_pixel_id: checkout.fb_pixel_id ?? "",
      tiktok_pixel_id: checkout.tiktok_pixel_id ?? "",
      google_ads_id: checkout.google_ads_id ?? "",
      google_ads_label: checkout.google_ads_label ?? "",
      gtm_id: checkout.gtm_id ?? "",
    });
    setBumpPickerOpen(false);
    setDialogOpen(true);
  };

  const openNew = () => { setEditingId(null); setForm(emptyForm); setActiveTab("info"); setBumpPickerOpen(false); setDialogOpen(true); };

  const addBump = (productId: string) => {
    if (!productId || productId === "__none__") return;

    // Validate currency match
    const mainProduct = products?.find((p: any) => p.id === form.product_id);
    const bumpProduct = products?.find((p: any) => p.id === productId);
    if (mainProduct && bumpProduct && (mainProduct.currency || "eur") !== (bumpProduct.currency || "eur")) {
      toast.error(`Moeda incompatível: o produto principal usa ${(mainProduct.currency || "eur").toUpperCase()} mas este bump usa ${(bumpProduct.currency || "eur").toUpperCase()}`);
      return;
    }

    let alreadyExists = false;
    setForm((prev) => {
      if (prev.order_bump_product_ids.includes(productId)) {
        alreadyExists = true;
        return prev;
      }

      return {
        ...prev,
        order_bump_product_ids: [...prev.order_bump_product_ids, productId],
      };
    });

    if (alreadyExists) {
      toast.error("Este produto já está como order bump");
      return;
    }

    setBumpPickerOpen(false);
  };

  const removeBump = (productId: string) => {
    setForm((prev) => {
      const nextDescriptions = { ...prev.order_bump_descriptions };
      delete nextDescriptions[productId];

      return {
        ...prev,
        order_bump_product_ids: prev.order_bump_product_ids.filter((id) => id !== productId),
        order_bump_descriptions: nextDescriptions,
      };
    });
  };

  const selectedProduct = products?.find((p: any) => p.id === form.product_id);
  const bumpProducts = (products || []).filter((p: any) => form.order_bump_product_ids.includes(p.id));
  const mainCurrency = selectedProduct?.currency || "eur";
  const availableBumpProducts = (products || []).filter((p: any) => p.id !== form.product_id && !form.order_bump_product_ids.includes(p.id) && (p.currency || "eur") === mainCurrency);

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
           <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0" aria-describedby={undefined}>
             <DialogHeader className="px-5 pt-4 pb-0"><DialogTitle className="text-base">{editingId ? "Editar Checkout" : "Novo Checkout"}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="flex h-[calc(92vh-60px)]">
              {/* LEFT: Settings */}
              <div className="flex-1 min-w-0 overflow-y-auto px-5 py-4 border-r border-border space-y-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full mb-4 bg-secondary border border-border">
                  <TabsTrigger value="info" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Info</TabsTrigger>
                  <TabsTrigger value="design" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Palette className="mr-1 h-3 w-3" strokeWidth={1.5} />Design</TabsTrigger>
                  <TabsTrigger value="conversion" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Zap className="mr-1 h-3 w-3" strokeWidth={1.5} />Conversão</TabsTrigger>
                  <TabsTrigger value="pixels" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ScanLine className="mr-1 h-3 w-3" strokeWidth={1.5} />Pixels</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Nome</Label><Input value={form.name} onChange={(e) => { const name = e.target.value; setForm({ ...form, name, checkout_slug: editingId ? form.checkout_slug : slugify(name) }); }} required /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Slug</Label><Input value={form.checkout_slug} onChange={(e) => setForm({ ...form, checkout_slug: e.target.value })} required /><p className="text-[10px] text-muted-foreground">URL: /checkout/{form.checkout_slug || "..."}</p></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Produto Principal</Label><Select value={form.product_id} onValueChange={(v) => { const newProduct = products?.find((p: any) => p.id === v); const oldProduct = products?.find((p: any) => p.id === form.product_id); const currencyChanged = (newProduct?.currency || "eur") !== (oldProduct?.currency || "eur"); setForm({ ...form, product_id: v, ...(currencyChanged ? { order_bump_product_ids: [], order_bump_descriptions: {} } : {}) }); if (currencyChanged && form.order_bump_product_ids.length > 0) toast.info("Order bumps removidos: moeda do produto principal mudou"); }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products?.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name} <span className="text-muted-foreground ml-1">({(p.currency || "eur").toUpperCase()})</span></SelectItem>))}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">URL Final (após pagamento)</Label><Input value={form.redirect_url} onChange={(e) => setForm({ ...form, redirect_url: e.target.value })} placeholder="https://exemplo.com/obrigado" required /></div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Order Bumps</Label>
                    {bumpProducts.length > 0 && (
                      <div className="space-y-3">
                        {bumpProducts.map((bp: any, idx: number) => (
                          <div key={bp.id} className="rounded-lg border border-border bg-input px-3 py-3 space-y-2">
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                              <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate text-foreground">{bp.name}</p><p className="text-[11px] text-muted-foreground">{formatCents(bp.price, bp.currency || "eur")}</p></div>
                              <Badge variant="secondary" className="text-[10px] shrink-0">#{idx + 1}</Badge>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBump(bp.id)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                            </div>
                            <div className="pl-7">
                              <Textarea
                                value={form.order_bump_descriptions[bp.id] || ""}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    order_bump_descriptions: {
                                      ...prev.order_bump_descriptions,
                                      [bp.id]: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Copy do bump (ex: Adicione e economize 30%!)"
                                className="text-xs min-h-[60px] resize-y"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {availableBumpProducts.length > 0 && (
                      <Popover open={bumpPickerOpen} onOpenChange={setBumpPickerOpen}>
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
                              onClick={() => addBump(p.id)}
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

                <TabsContent value="design" className="space-y-4 pb-2">
                  <BannerUpload value={form.banner_url} onChange={(url) => setForm({ ...form, banner_url: url })} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[{ label: "Cor Primária", key: "primary_color" as const }, { label: "Cor Secundária", key: "accent_color" as const }, { label: "Cor de Fundo", key: "bg_color" as const }].map((c) => (
                      <div key={c.key} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{c.label}</Label>
                        <div className="flex gap-2 items-center"><input type="color" value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" /><Input value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className="flex-1 text-xs" /></div>
                      </div>
                    ))}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cor do Botão de Compra</Label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={form.cta_button_color || form.primary_color} onChange={(e) => setForm({ ...form, cta_button_color: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" />
                        <Input value={form.cta_button_color} onChange={(e) => setForm({ ...form, cta_button_color: e.target.value })} className="flex-1 text-xs" placeholder="Deixe vazio para usar a cor primária" />
                        {form.cta_button_color && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setForm({ ...form, cta_button_color: "" })}><X className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Headline</Label><Input value={form.headline_text} onChange={(e) => setForm({ ...form, headline_text: e.target.value })} placeholder="Deixe vazio para usar o nome do produto" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Texto do Botão (CTA)</Label><Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Finalizar compra" /></div>
                  </div>
                  <div className="flex items-center gap-3 pt-2 pb-1"><Switch checked={form.show_product_image} onCheckedChange={(v) => setForm({ ...form, show_product_image: v })} /><Label className="text-xs text-muted-foreground">Mostrar imagem do produto</Label></div>
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
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Texto antes de expirar</Label><Input value={form.countdown_text} onChange={(e) => setForm({ ...form, countdown_text: e.target.value })} placeholder="Tempo a esgotar. Desconto expira em:" /></div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Duração (minutos)</Label><Input type="number" min={1} max={120} value={form.countdown_duration} onChange={(e) => setForm({ ...form, countdown_duration: parseInt(e.target.value) || 10 })} /></div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Texto após expirar (quando o tempo chega a 00:00)</Label>
                          <Input value={form.countdown_expired_text} onChange={(e) => setForm({ ...form, countdown_expired_text: e.target.value })} placeholder="O tempo acabou mas ainda podes comprar!" />
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
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Preview</Label>
                          <div className="rounded-lg overflow-hidden border border-border space-y-0">
                            <div className="py-2 px-4 flex items-center justify-center gap-2 text-sm font-semibold" style={{ backgroundColor: form.countdown_bg_color, color: form.countdown_text_color }}>
                              <Zap className="h-4 w-4" /><span>{form.countdown_text}</span><span className="tabular-nums font-bold text-base">09:58</span>
                            </div>
                            <div className="py-2 px-4 flex items-center justify-center gap-2 text-sm font-semibold border-t" style={{ backgroundColor: form.countdown_bg_color, color: form.countdown_text_color, borderColor: 'rgba(255,255,255,0.2)' }}>
                              <span>⏱</span><span>{form.countdown_expired_text || "O tempo acabou mas ainda podes comprar!"}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">↑ Antes do tempo acabar &nbsp;|&nbsp; ↓ Depois do tempo acabar</p>
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

                <TabsContent value="pixels" className="space-y-5 pb-2">
                  <p className="text-[11px] text-muted-foreground">Configure pixels de rastreamento para disparar eventos automaticamente no checkout e na página de sucesso.</p>

                  {/* Meta Pixel */}
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      <Label className="text-sm font-semibold text-foreground">Meta (Facebook) Pixel</Label>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Pixel ID</Label>
                      <Input
                        value={form.fb_pixel_id}
                        onChange={(e) => setForm({ ...form, fb_pixel_id: e.target.value })}
                        placeholder="Ex: 1234567890123456"
                        className="text-xs font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">Encontre em: Meta Business Suite → Events Manager → Pixels</p>
                    </div>
                    {form.fb_pixel_id && (
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-medium">ViewContent — checkout</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-medium">Purchase — sucesso</span>
                      </div>
                    )}
                  </div>

                  {/* TikTok Pixel */}
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.72a8.19 8.19 0 004.77 1.52V6.79a4.85 4.85 0 01-1-.1z"/></svg>
                      <Label className="text-sm font-semibold text-foreground">TikTok Pixel</Label>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Pixel ID</Label>
                      <Input
                        value={form.tiktok_pixel_id}
                        onChange={(e) => setForm({ ...form, tiktok_pixel_id: e.target.value })}
                        placeholder="Ex: C9ABC1234DEF5678"
                        className="text-xs font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">Encontre em: TikTok Ads Manager → Assets → Events → Web Events</p>
                    </div>
                    {form.tiktok_pixel_id && (
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 text-[10px] font-medium">ViewContent — checkout</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 text-[10px] font-medium">CompletePayment — sucesso</span>
                      </div>
                    )}
                  </div>

                  {/* Google Ads */}
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      <Label className="text-sm font-semibold text-foreground">Google Ads</Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Conversion ID</Label>
                        <Input
                          value={form.google_ads_id}
                          onChange={(e) => setForm({ ...form, google_ads_id: e.target.value })}
                          placeholder="Ex: AW-123456789"
                          className="text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Conversion Label</Label>
                        <Input
                          value={form.google_ads_label}
                          onChange={(e) => setForm({ ...form, google_ads_label: e.target.value })}
                          placeholder="Ex: AbCdEfGhIjKlMnOp"
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Google Ads → Metas → Conversões → Detalhes da conversão</p>
                    {form.google_ads_id && form.google_ads_label && (
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 text-[10px] font-medium">Conversion — sucesso</span>
                      </div>
                    )}
                  </div>

                  {/* GTM */}
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#4285F4"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                      <Label className="text-sm font-semibold text-foreground">Google Tag Manager</Label>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Container ID</Label>
                      <Input
                        value={form.gtm_id}
                        onChange={(e) => setForm({ ...form, gtm_id: e.target.value })}
                        placeholder="Ex: GTM-XXXXXXX"
                        className="text-xs font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">GTM carrega todos os seus tags configurados. Use para múltiplos pixels via uma única integração.</p>
                    </div>
                    {form.gtm_id && (
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-medium">dataLayer push — checkout + sucesso</span>
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
              <div className="border-t border-border pt-4 mt-2">
                <Button type="submit" className="w-full mb-1 h-10 bg-primary text-primary-foreground font-bold hover:brightness-110 active:scale-[0.98]" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
              </div>
              </div>

              {/* RIGHT: Live Preview (always visible) */}
              <div className="w-[340px] shrink-0 overflow-y-auto bg-secondary/30 px-4 py-4 flex flex-col gap-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preview em tempo real</p>
                <div className="sticky top-0">
                  <CheckoutLivePreview form={form} product={selectedProduct} bumpProducts={bumpProducts} />
                </div>
              </div>

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
