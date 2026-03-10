import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatCents } from "@/lib/formatters";
import { Loader2, ShieldCheck, Lock, CreditCard, CheckCircle2, Sparkles } from "lucide-react";

interface BumpProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
}

interface CheckoutData {
  id: string;
  name: string;
  checkout_slug: string;
  redirect_url: string;
  product_id: string;
  primary_color: string;
  accent_color: string;
  bg_color: string;
  headline_text: string | null;
  cta_text: string;
  banner_url: string | null;
  show_product_image: boolean;
  product: { id: string; name: string; description: string | null; price: number; currency: string; image_url: string | null };
  bump_products: BumpProduct[];
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [abandonedSaved, setAbandonedSaved] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utms: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
      const val = params.get(key);
      if (val) utms[key] = val;
    });
    if (Object.keys(utms).length > 0) {
      sessionStorage.setItem("checkout_utms", JSON.stringify(utms));
    }
  }, []);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      const { data, error } = await supabase
        .from("checkouts")
        .select("*, products!checkouts_product_id_fkey(id, name, description, price, currency, image_url)")
        .eq("checkout_slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Load bumps from junction table
      const { data: bumpsData } = await supabase
        .from("checkout_order_bumps")
        .select("product_id, sort_order, products(id, name, price, currency)")
        .eq("checkout_id", data.id)
        .order("sort_order");

      const bumpProducts: BumpProduct[] = (bumpsData || [])
        .filter((b: any) => b.products)
        .map((b: any) => ({
          id: b.products.id,
          name: b.products.name,
          price: b.products.price,
          currency: b.products.currency || "brl",
        }));

      const checkoutData: CheckoutData = {
        ...data,
        primary_color: data.primary_color || "#2563eb",
        accent_color: data.accent_color || "#1e40af",
        bg_color: data.bg_color || "#f8fafc",
        cta_text: data.cta_text || "Finalizar compra",
        show_product_image: data.show_product_image ?? true,
        product: data.products as any,
        bump_products: bumpProducts,
      };

      setCheckout(checkoutData);
      setLoading(false);
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (email && email.includes("@") && !abandonedSaved && checkout) {
      const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");
      supabase
        .from("abandoned_checkouts")
        .insert({
          checkout_id: checkout.id,
          name: customerName || null,
          email,
          phone: phone || null,
          utm_data: Object.keys(utms).length > 0 ? utms : null,
        })
        .then(() => setAbandonedSaved(true));
    }
  }, [email, abandonedSaved, checkout, customerName, phone]);

  const toggleBump = (productId: string) => {
    setSelectedBumps((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const totalAmount = () => {
    if (!checkout) return 0;
    let total = checkout.product.price;
    checkout.bump_products.forEach((bp) => {
      if (selectedBumps.has(bp.id)) {
        total += bp.price;
      }
    });
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkout) return;

    if (!customerName.trim() || !email.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setProcessing(true);
    try {
      const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");

      const { data: intentData, error: intentError } = await supabase.functions.invoke("create-intent", {
        body: {
          checkout_id: checkout.id,
          customer_name: customerName,
          customer_email: email,
          customer_phone: phone || null,
          selected_bump_ids: Array.from(selectedBumps),
          utm_data: utms,
        },
      });

      if (intentError) throw new Error(intentError.message || "Erro ao criar pagamento");
      if (intentData?.error) throw new Error(intentData.error);

      if (intentData?.url) {
        window.location.href = intentData.url;
      } else {
        throw new Error("URL de pagamento não recebida");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar pagamento. Tente novamente.");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#2563eb" }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <span className="text-2xl">🔍</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Página não encontrada</h1>
          <p className="text-gray-500 text-sm">Este checkout não existe ou foi desativado.</p>
        </div>
      </div>
    );
  }

  const c = checkout!;
  const currency = c.product.currency || "brl";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12" style={{ backgroundColor: c.bg_color }}>
      <div className="w-full max-w-[460px] space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: c.primary_color + "1a", color: c.primary_color }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Oferta disponível
          </div>

          {c.show_product_image && c.product.image_url && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto shadow-md border border-gray-100">
              <img src={c.product.image_url} alt={c.product.name} className="w-full h-full object-cover" />
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {c.headline_text || c.product.name}
          </h1>
          {c.product.description && (
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              {c.product.description}
            </p>
          )}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-black/5 border border-gray-100 overflow-hidden">
          {c.banner_url && (
            <div className="w-full h-32 overflow-hidden">
              <img src={c.banner_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Price */}
          <div
            className="px-6 py-5 text-center"
            style={{ background: `linear-gradient(135deg, ${c.primary_color}, ${c.accent_color})` }}
          >
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Investimento</p>
            <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {formatCents(c.product.price, currency)}
            </div>
          </div>

          {/* Form */}
          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Nome completo
                  </Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    required
                    className="h-11 rounded-lg bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="h-11 rounded-lg bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    WhatsApp <span className="text-gray-300 normal-case font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="h-11 rounded-lg bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Order Bumps */}
              {c.bump_products.length > 0 && (
                <div className="space-y-3">
                  {c.bump_products.map((bp, idx) => (
                    <div
                      key={bp.id}
                      className={`relative rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${
                        selectedBumps.has(bp.id) ? "shadow-sm" : "border-dashed hover:border-opacity-60"
                      }`}
                      style={{
                        borderColor: selectedBumps.has(bp.id) ? c.primary_color : "#e5e7eb",
                        backgroundColor: selectedBumps.has(bp.id) ? c.primary_color + "08" : "transparent",
                      }}
                      onClick={() => toggleBump(bp.id)}
                    >
                      {idx === 0 && (
                        <div className="absolute -top-2.5 left-4">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white flex items-center gap-1"
                            style={{ backgroundColor: c.primary_color }}
                          >
                            <Sparkles className="h-3 w-3" />
                            Oferta especial
                          </span>
                        </div>
                      )}
                      <div className={`flex items-center gap-3 ${idx === 0 ? "mt-1" : ""}`}>
                        <Checkbox
                          checked={selectedBumps.has(bp.id)}
                          onCheckedChange={() => toggleBump(bp.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <label className="font-semibold text-sm cursor-pointer text-gray-900">
                            Adicionar: {bp.name}
                          </label>
                          <p className="text-xs text-gray-500 mt-0.5">Aproveite o desconto exclusivo</p>
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap" style={{ color: c.primary_color }}>
                          +{formatCents(bp.price, bp.currency || currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{c.product.name}</span>
                  <span>{formatCents(c.product.price, currency)}</span>
                </div>
                {c.bump_products
                  .filter((bp) => selectedBumps.has(bp.id))
                  .map((bp) => (
                    <div key={bp.id} className="flex justify-between items-center text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" style={{ color: c.primary_color }} />
                        {bp.name}
                      </span>
                      <span>+{formatCents(bp.price, bp.currency || currency)}</span>
                    </div>
                  ))}
                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Total a pagar</span>
                  <span className="text-2xl font-extrabold text-gray-900">
                    {formatCents(totalAmount(), currency)}
                  </span>
                </div>
              </div>

              {/* CTA */}
              <Button
                type="submit"
                className="w-full h-14 text-base font-bold rounded-xl transition-all duration-200 border-0"
                disabled={processing}
                style={{
                  backgroundColor: c.primary_color,
                  color: "white",
                  boxShadow: `0 10px 25px -5px ${c.primary_color}33, 0 8px 10px -6px ${c.primary_color}22`,
                }}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    {c.cta_text}
                  </>
                )}
              </Button>

              {/* Trust */}
              <div className="flex items-center justify-center gap-4 text-gray-400">
                <div className="flex items-center gap-1.5 text-xs">
                  <Lock className="h-3.5 w-3.5" />
                  <span>SSL Seguro</span>
                </div>
                <div className="h-3 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Dados protegidos</span>
                </div>
                <div className="h-3 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5 text-xs">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Stripe</span>
                </div>
              </div>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 leading-relaxed">
          Ao clicar em "{c.cta_text}", você será redirecionado para um ambiente seguro de pagamento.
        </p>
      </div>
    </div>
  );
}
