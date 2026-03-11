import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCents } from "@/lib/formatters";
import { Loader2, ShieldCheck, Lock, CreditCard, CheckCircle2, Sparkles } from "lucide-react";

const stripePromise = loadStripe("pk_live_51SqaDe4tVPtm5YNwa58VQ0RR9WVz3P74IcqGrWTtSpmwyiO1e3kMQDhje36XacNAnGMfxvNtibgDWIhZicY73pg700Fw5mltxV");

const COUNTRY_CODES = [
  { code: "+55", flag: "🇧🇷", country: "BR", label: "Brasil" },
  { code: "+1", flag: "🇺🇸", country: "US", label: "EUA" },
  { code: "+54", flag: "🇦🇷", country: "AR", label: "Argentina" },
  { code: "+56", flag: "🇨🇱", country: "CL", label: "Chile" },
  { code: "+57", flag: "🇨🇴", country: "CO", label: "Colômbia" },
  { code: "+52", flag: "🇲🇽", country: "MX", label: "México" },
  { code: "+51", flag: "🇵🇪", country: "PE", label: "Peru" },
  { code: "+598", flag: "🇺🇾", country: "UY", label: "Uruguai" },
  { code: "+595", flag: "🇵🇾", country: "PY", label: "Paraguai" },
  { code: "+591", flag: "🇧🇴", country: "BO", label: "Bolívia" },
  { code: "+593", flag: "🇪🇨", country: "EC", label: "Equador" },
  { code: "+58", flag: "🇻🇪", country: "VE", label: "Venezuela" },
  { code: "+44", flag: "🇬🇧", country: "GB", label: "Reino Unido" },
  { code: "+49", flag: "🇩🇪", country: "DE", label: "Alemanha" },
  { code: "+33", flag: "🇫🇷", country: "FR", label: "França" },
  { code: "+34", flag: "🇪🇸", country: "ES", label: "Espanha" },
  { code: "+39", flag: "🇮🇹", country: "IT", label: "Itália" },
  { code: "+351", flag: "🇵🇹", country: "PT", label: "Portugal" },
  { code: "+81", flag: "🇯🇵", country: "JP", label: "Japão" },
  { code: "+91", flag: "🇮🇳", country: "IN", label: "Índia" },
  { code: "+61", flag: "🇦🇺", country: "AU", label: "Austrália" },
];

const COUNTRY_TO_DDI: Record<string, string> = {};
COUNTRY_CODES.forEach((c) => { COUNTRY_TO_DDI[c.country] = c.code; });

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
  first_offer_id: string | null;
  product: { id: string; name: string; description: string | null; price: number; currency: string; image_url: string | null };
  bump_products: BumpProduct[];
}

const CARD_ELEMENT_STYLE = {
  base: {
    fontSize: "16px",
    color: "#1a1a2e",
    fontFamily: "system-ui, -apple-system, sans-serif",
    "::placeholder": { color: "#9ca3af" },
    lineHeight: "44px",
  },
  invalid: { color: "#ef4444" },
};

function CheckoutForm({ checkout: c }: { checkout: CheckoutData }) {
  const stripe = useStripe();
  const elements = useElements();

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [ddi, setDdi] = useState("+55");
  const [phone, setPhone] = useState("");
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [abandonedSaved, setAbandonedSaved] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Recover prefill data from abandoned checkout
  useEffect(() => {
    try {
      const recovery = sessionStorage.getItem("checkout_recovery");
      if (recovery) {
        const data = JSON.parse(recovery);
        if (data.name) setCustomerName(data.name);
        if (data.email) {
          setEmail(data.email);
          setAbandonedSaved(true); // Don't re-create abandoned checkout
        }
        if (data.phone) {
          // Try to split DDI from phone
          const fullPhone = data.phone.replace(/\D/g, "");
          // Check if starts with known DDI
          const match = COUNTRY_CODES.find((cc) => fullPhone.startsWith(cc.code.replace("+", "")));
          if (match) {
            setDdi(match.code);
            setPhone(fullPhone.substring(match.code.replace("+", "").length));
          } else {
            setPhone(fullPhone);
          }
        }
        sessionStorage.removeItem("checkout_recovery");
      }
    } catch {}
  }, []);

  const currency = c.product.currency || "brl";

  // Auto-detect country code
  useEffect(() => {
    async function detectCountry() {
      try {
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        if (data?.country_code && COUNTRY_TO_DDI[data.country_code]) {
          setDdi(COUNTRY_TO_DDI[data.country_code]);
        }
      } catch {
        try {
          const locale = navigator.language || "pt-BR";
          const region = locale.split("-")[1]?.toUpperCase();
          if (region && COUNTRY_TO_DDI[region]) setDdi(COUNTRY_TO_DDI[region]);
        } catch {}
      }
    }
    detectCountry();
  }, []);

  // Save UTMs
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

  // Abandoned checkout
  useEffect(() => {
    if (email && email.includes("@") && !abandonedSaved && c) {
      const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");
      supabase
        .from("abandoned_checkouts")
        .insert({
          checkout_id: c.id,
          name: customerName || null,
          email,
          phone: phone ? `${ddi}${phone}` : null,
          utm_data: Object.keys(utms).length > 0 ? utms : null,
        } as any)
        .then(() => setAbandonedSaved(true));
    }
  }, [email, abandonedSaved, c, customerName, phone, ddi]);

  const toggleBump = (productId: string) => {
    setSelectedBumps((prev) => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  };

  const totalAmount = () => {
    let total = c.product.price;
    c.bump_products.forEach((bp) => {
      if (selectedBumps.has(bp.id)) total += bp.price;
    });
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (!customerName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) {
      toast.error("Erro ao carregar campo de cartão");
      return;
    }

    setProcessing(true);
    setCardError(null);

    try {
      const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");
      const fullPhone = `${ddi}${phone.replace(/\D/g, "")}`;

      // 1. Create PaymentIntent on server
      const { data: intentData, error: intentError } = await supabase.functions.invoke("create-intent", {
        body: {
          checkout_id: c.id,
          customer_name: customerName,
          customer_email: email,
          customer_phone: fullPhone,
          selected_bump_ids: Array.from(selectedBumps),
          utm_data: utms,
        },
      });

      if (intentError) throw new Error(intentError.message || "Erro ao criar pagamento");
      if (intentData?.error) throw new Error(intentData.error);
      if (!intentData?.client_secret) throw new Error("Erro interno ao processar pagamento");

      // 2. Confirm payment with card details
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(intentData.client_secret, {
        payment_method: {
          card: cardNumber,
          billing_details: {
            name: customerName,
            email: email,
            phone: fullPhone,
          },
        },
      });

      if (stripeError) {
        if (stripeError.type === "card_error" || stripeError.type === "validation_error") {
          setCardError(stripeError.message || "Erro no cartão");
        } else {
          setCardError("Ocorreu um erro inesperado. Tente novamente.");
        }
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        // Redirect to success or offer page
        if (c.first_offer_id) {
          window.location.href = `/success/${c.id}?payment_intent_id=${paymentIntent.id}`;
        } else {
          window.location.href = `${c.redirect_url}${c.redirect_url.includes("?") ? "&" : "?"}payment_intent_id=${paymentIntent.id}`;
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar pagamento. Tente novamente.");
      setProcessing(false);
    }
  };

  const selectedDdiEntry = COUNTRY_CODES.find((cc) => cc.code === ddi);

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
              {/* Personal Info */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Nome completo <span className="text-red-400">*</span>
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
                    Email <span className="text-red-400">*</span>
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
                    WhatsApp <span className="text-red-400">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Select value={ddi} onValueChange={setDdi}>
                      <SelectTrigger className="w-[110px] h-11 rounded-lg bg-gray-50 border-gray-200 shrink-0">
                        <SelectValue>
                          {selectedDdiEntry ? `${selectedDdiEntry.flag} ${selectedDdiEntry.code}` : ddi}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {COUNTRY_CODES.map((cc) => (
                          <SelectItem key={cc.code} value={cc.code}>
                            {cc.flag} {cc.code} ({cc.label})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      required
                      className="h-11 rounded-lg bg-gray-50 border-gray-200 focus:bg-white transition-colors flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Card Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" style={{ color: c.primary_color }} />
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Dados do cartão <span className="text-red-400">*</span>
                  </Label>
                </div>

                <div className="space-y-3">
                  <div className="h-11 rounded-lg bg-gray-50 border border-gray-200 px-3 flex items-center transition-colors focus-within:bg-white focus-within:border-gray-300 focus-within:ring-2 focus-within:ring-gray-100">
                    <CardNumberElement
                      options={{ style: CARD_ELEMENT_STYLE, placeholder: "Número do cartão" }}
                      onChange={(e) => setCardError(e.error?.message || null)}
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-11 rounded-lg bg-gray-50 border border-gray-200 px-3 flex items-center transition-colors focus-within:bg-white focus-within:border-gray-300 focus-within:ring-2 focus-within:ring-gray-100">
                      <CardExpiryElement
                        options={{ style: CARD_ELEMENT_STYLE, placeholder: "MM / AA" }}
                        className="w-full"
                      />
                    </div>
                    <div className="h-11 rounded-lg bg-gray-50 border border-gray-200 px-3 flex items-center transition-colors focus-within:bg-white focus-within:border-gray-300 focus-within:ring-2 focus-within:ring-gray-100">
                      <CardCvcElement
                        options={{ style: CARD_ELEMENT_STYLE, placeholder: "CVC" }}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {cardError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                    {cardError}
                  </p>
                )}
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
                disabled={processing || !stripe}
                style={{
                  backgroundColor: c.primary_color,
                  color: "white",
                  boxShadow: `0 10px 25px -5px ${c.primary_color}33, 0 8px 10px -6px ${c.primary_color}22`,
                }}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando pagamento...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    {c.cta_text} — {formatCents(totalAmount(), currency)}
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
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

      const { data: bumpsData } = await supabase
        .from("checkout_order_bumps" as any)
        .select("product_id, sort_order, products(id, name, price, currency)")
        .eq("checkout_id", data.id)
        .order("sort_order");

      const bumpProducts: BumpProduct[] = ((bumpsData as any[]) || [])
        .filter((b: any) => b.products)
        .map((b: any) => ({
          id: b.products.id,
          name: b.products.name,
          price: b.products.price,
          currency: b.products.currency || "brl",
        }));

      setCheckout({
        ...data,
        primary_color: data.primary_color || "#2563eb",
        accent_color: data.accent_color || "#1e40af",
        bg_color: data.bg_color || "#f8fafc",
        cta_text: data.cta_text || "Finalizar compra",
        show_product_image: data.show_product_image ?? true,
        first_offer_id: data.first_offer_id,
        product: data.products as any,
        bump_products: bumpProducts,
      });
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#2563eb" }} />
      </div>
    );
  }

  if (notFound || !checkout) {
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

  return (
    <Elements stripe={stripePromise} options={{ locale: "pt-BR" }}>
      <CheckoutForm checkout={checkout} />
    </Elements>
  );
}
