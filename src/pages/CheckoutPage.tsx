import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCents } from "@/lib/formatters";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import { COUNTRY_CODES, COUNTRY_TO_DDI } from "@/lib/countryCodes";
import { CheckoutCountdownBar } from "@/components/CheckoutCountdownBar";
import { SalesNotificationPopup } from "@/components/SalesNotificationPopup";
import { getLangFromCountry, getTranslations, getStripeLocale, type CheckoutLang, type CheckoutTranslations } from "@/lib/checkoutTranslations";

const stripePromise = loadStripe("pk_live_51T9VKyGfpSpNOdDI6GT8Bq78Kn7NagZZuB880xuOksJD8TPAfOFIZ762lhXVg3EbJIcf66uoOvdweVF4kjrkCU3700yfUxyd0d");

function useDocTitle(title: string) {
  useEffect(() => { document.title = title; return () => { document.title = "Yocota"; }; }, [title]);
}

interface BumpProduct { id: string; name: string; description: string | null; price: number; currency: string; bump_description: string | null; }
interface CheckoutData {
  id: string; name: string; checkout_slug: string; redirect_url: string; product_id: string;
  primary_color: string; accent_color: string; bg_color: string;
  headline_text: string | null; cta_text: string; banner_url: string | null;
  show_product_image: boolean; first_offer_id: string | null;
  product: { id: string; name: string; description: string | null; price: number; currency: string; image_url: string | null };
  bump_products: BumpProduct[];
  countdown_enabled: boolean;
  countdown_duration: number;
  countdown_text: string;
  countdown_bg_color: string;
  countdown_text_color: string;
  social_proof_enabled: boolean;
  social_proof_messages: string[];
  social_proof_interval: number;
  social_proof_display_duration: number;
  social_proof_position: "bottom-left" | "bottom-right";
}

const CARD_STYLE = {
  base: { fontSize: "14px", color: "#1a1a1a", fontFamily: "Inter, system-ui, sans-serif", "::placeholder": { color: "#a3a3a3" }, lineHeight: "40px" },
  invalid: { color: "#ef4444" },
};

/** Convert hex to rgba */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function CheckoutForm({ checkout: c, lang, t }: { checkout: CheckoutData; lang: CheckoutLang; t: CheckoutTranslations }) {
  const stripe = useStripe();
  const elements = useElements();

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("BR");
  const [phone, setPhone] = useState("");
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [abandonedSaved, setAbandonedSaved] = useState(false);
  const abandonedSavingRef = useRef(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Dynamic colors from checkout config
  const pc = c.primary_color || "#2563eb";
  const pcRing = hexToRgba(pc, 0.15);
  const pcBg = hexToRgba(pc, 0.06);

  useDocTitle(c.product.name ? `${c.product.name} — Checkout` : "Checkout");

  const selectedEntry = COUNTRY_CODES.find((cc) => cc.country === selectedCountry);
  const ddi = selectedEntry?.code || "+55";

  const validateField = (field: string, value: string) => {
    const errors = { ...fieldErrors };
    switch (field) {
      case "name":
        if (!value.trim()) errors.name = t.nameRequired;
        else if (value.trim().length < 3) errors.name = t.nameMinLength;
        else delete errors.name;
        break;
      case "email":
        if (!value.trim()) errors.email = t.emailRequired;
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.email = t.emailInvalid;
        else delete errors.email;
        break;
      case "phone":
        if (!value.trim()) errors.phone = t.phoneRequired;
        else if (value.replace(/\D/g, "").length < 8) errors.phone = t.phoneTooShort;
        else delete errors.phone;
        break;
    }
    setFieldErrors(errors);
  };

  useEffect(() => {
    try {
      const recovery = sessionStorage.getItem("checkout_recovery");
      if (recovery) {
        const data = JSON.parse(recovery);
        if (data.name) setCustomerName(data.name);
        if (data.email) { setEmail(data.email); setAbandonedSaved(true); }
        if (data.phone) {
          const fullPhone = data.phone.replace(/\D/g, "");
          const match = COUNTRY_CODES.find((cc) => fullPhone.startsWith(cc.code.replace("+", "")));
          if (match) { setSelectedCountry(match.country); setPhone(fullPhone.substring(match.code.replace("+", "").length)); }
          else setPhone(fullPhone);
        }
        sessionStorage.removeItem("checkout_recovery");
      }
    } catch {}
  }, []);

  const currency = c.product.currency || "eur";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utms: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => { const val = params.get(key); if (val) utms[key] = val; });
    if (Object.keys(utms).length > 0) sessionStorage.setItem("checkout_utms", JSON.stringify(utms));
  }, []);

  const toggleBump = (productId: string) => {
    setSelectedBumps((prev) => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  };

  const totalAmount = () => {
    let total = c.product.price;
    c.bump_products.forEach((bp) => { if (selectedBumps.has(bp.id)) total += bp.price; });
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    validateField("name", customerName);
    validateField("email", email);
    validateField("phone", phone);
    if (!customerName.trim() || !email.trim() || !phone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 8) {
      toast.error(t.fillAllFields);
      return;
    }

    if (!abandonedSaved && !abandonedSavingRef.current) {
      abandonedSavingRef.current = true;
      const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");
      const fullPhoneForAbandoned = `${ddi}${phone.replace(/\D/g, "")}`;
      await supabase.from("abandoned_checkouts").insert({ checkout_id: c.id, name: customerName || null, email, phone: fullPhoneForAbandoned, utm_data: Object.keys(utms).length > 0 ? utms : null } as any).then(() => { setAbandonedSaved(true); }, () => { abandonedSavingRef.current = false; });
    }

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) { toast.error(t.cardLoadError); return; }
    setProcessing(true); setCardError(null);
    try {
      const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");
      const fullPhone = `${ddi}${phone.replace(/\D/g, "")}`;
      const bumpIdsArray = Array.from(selectedBumps);
      const { data: intentData, error: intentError } = await supabase.functions.invoke("create-intent", {
        body: { checkout_id: c.id, customer_name: customerName, customer_email: email, customer_phone: fullPhone, selected_bump_ids: bumpIdsArray, utm_data: utms },
      });
      if (intentError) throw new Error(intentError.message || "Erro ao criar pagamento");
      if (intentData?.error) throw new Error(intentData.error);
      if (!intentData?.client_secret) throw new Error("Erro interno ao processar pagamento");
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(intentData.client_secret, {
        payment_method: { card: cardNumber, billing_details: { name: customerName, email, phone: fullPhone } },
      });
      if (stripeError) {
        if (stripeError.type === "card_error" && stripeError.code === "authentication_required") {
          const { error: authError, paymentIntent: authedPI } = await stripe.confirmCardPayment(intentData.client_secret);
          if (authError) { setCardError(authError.message || "Falha na autenticação 3D Secure"); setProcessing(false); return; }
          if (authedPI?.status === "succeeded") {
            setSuccess(true);
            setTimeout(() => {
              if (c.first_offer_id) window.location.href = `/success/${c.id}?payment_intent_id=${authedPI.id}`;
              else window.location.href = `${c.redirect_url}${c.redirect_url.includes("?") ? "&" : "?"}payment_intent_id=${authedPI.id}`;
            }, 800);
            return;
          }
        }
        setCardError(stripeError.type === "card_error" || stripeError.type === "validation_error" ? stripeError.message || "Erro no cartão" : "Erro inesperado. Tente novamente.");
        setProcessing(false); return;
      }
      if (paymentIntent?.status === "requires_action") {
        const { error: actionError, paymentIntent: actionPI } = await stripe.confirmCardPayment(intentData.client_secret);
        if (actionError) { setCardError(actionError.message || "Falha na autenticação"); setProcessing(false); return; }
        if (actionPI?.status === "succeeded") {
          setSuccess(true);
          setTimeout(() => {
            if (c.first_offer_id) window.location.href = `/success/${c.id}?payment_intent_id=${actionPI.id}`;
            else window.location.href = `${c.redirect_url}${c.redirect_url.includes("?") ? "&" : "?"}payment_intent_id=${actionPI.id}`;
          }, 800);
          return;
        }
      }
      if (paymentIntent?.status === "succeeded") {
        setSuccess(true);
        setTimeout(() => {
          if (c.first_offer_id) window.location.href = `/success/${c.id}?payment_intent_id=${paymentIntent.id}`;
          else window.location.href = `${c.redirect_url}${c.redirect_url.includes("?") ? "&" : "?"}payment_intent_id=${paymentIntent.id}`;
        }, 800);
      }
    } catch (error: any) { toast.error(error.message || "Erro ao processar pagamento."); setProcessing(false); }
  };

  const inputClass = (hasError: boolean) =>
    `flex h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#1a1a1a] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-[3px] transition-all duration-150 ${
      hasError
        ? "border-[#ef4444] focus:border-[#ef4444] focus:ring-[rgba(239,68,68,0.12)]"
        : `border-[#d4d4d8]`
    }`;

  const renderBumpCard = (bp: BumpProduct) => {
    const isSelected = selectedBumps.has(bp.id);
    const displayDesc = bp.bump_description || bp.description;
    return (
      <div
        key={bp.id}
        className="rounded-[10px] border p-4 cursor-pointer transition-all duration-150"
        style={{
          borderColor: isSelected ? pc : "#d4d4d8",
          backgroundColor: isSelected ? pcBg : "#fafafa",
        }}
        onClick={() => toggleBump(bp.id)}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center transition-colors"
            style={{
              backgroundColor: isSelected ? pc : "transparent",
              borderColor: isSelected ? pc : "#d4d4d8",
            }}
          >
            {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#1a1a1a]">{bp.name}</p>
            {displayDesc && <p className="text-[11px] text-[#71717a] mt-0.5 line-clamp-2">{displayDesc}</p>}
          </div>
          <span className="text-[13px] font-bold tabular-nums" style={{ color: pc }}>+{formatCents(bp.price, bp.currency || currency)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <style>{`
        .checkout-input:focus { border-color: ${pc} !important; box-shadow: 0 0 0 3px ${pcRing} !important; }
        .checkout-card-field:focus-within { border-color: ${pc} !important; box-shadow: 0 0 0 3px ${pcRing} !important; }
        .checkout-select-trigger:focus { border-color: ${pc} !important; }
      `}</style>
      {c.countdown_enabled && (
        <CheckoutCountdownBar
          checkoutId={c.id}
          durationMinutes={c.countdown_duration}
          text={c.countdown_text}
          bgColor={c.countdown_bg_color}
          textColor={c.countdown_text_color}
        />
      )}
      {c.social_proof_enabled && c.social_proof_messages.length > 0 && (
        <SalesNotificationPopup
          messages={c.social_proof_messages}
          intervalSeconds={c.social_proof_interval}
          displayDurationSeconds={c.social_proof_display_duration}
          position={c.social_proof_position}
        />
      )}
      <div className="flex-1 flex flex-col lg:flex-row">
      {c.banner_url && (
        <div className="lg:hidden w-full">
          <img src={c.banner_url} alt="" className="w-full h-auto max-h-48 object-cover" crossOrigin="anonymous" />
        </div>
      )}

      {/* Left panel - Product summary */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#fafafa] border-r border-[#e4e4e7] flex-col sticky top-0 h-screen overflow-y-auto">
        {c.banner_url && (
          <div className="w-full shrink-0">
            <img src={c.banner_url} alt="" className="w-full h-auto max-h-56 object-cover" crossOrigin="anonymous" />
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center px-10 xl:px-16 py-12">
          <div className="max-w-md">
            {c.show_product_image && c.product.image_url && (
              <img src={c.product.image_url} alt={c.product.name} className="w-20 h-20 rounded-[10px] object-cover mb-5 border border-[#e4e4e7]" crossOrigin="anonymous" />
            )}
            <h1 className="text-xl font-semibold text-[#1a1a1a] mb-2">{c.headline_text || c.product.name}</h1>
            {c.product.description && <p className="text-sm text-[#71717a] leading-relaxed mb-8">{c.product.description}</p>}
            <div className="text-4xl font-bold text-[#1a1a1a] tabular-nums mb-8">{formatCents(c.product.price, currency)}</div>
            <div className="border-t border-[#e4e4e7]" />

            {c.bump_products.length > 0 && (
              <div className="mt-6 space-y-3">
                {c.bump_products.map(renderBumpCard)}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-[#e4e4e7]">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#71717a]">{t.total}</span>
                <span className="text-2xl font-bold text-[#1a1a1a] tabular-nums">{formatCents(totalAmount(), currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-5 sm:px-8 lg:px-10 xl:px-16 py-8 lg:py-12">
        <div className="max-w-md w-full mx-auto">
          <div className="lg:hidden mb-6">
            {c.show_product_image && c.product.image_url && (
              <img src={c.product.image_url} alt={c.product.name} className="w-16 h-16 rounded-[10px] object-cover mb-4 border border-[#e4e4e7]" crossOrigin="anonymous" />
            )}
            <h1 className="text-lg font-semibold text-[#1a1a1a] mb-1">{c.headline_text || c.product.name}</h1>
            {c.product.description && <p className="text-xs text-[#71717a] leading-relaxed mb-3">{c.product.description}</p>}
            <div className="text-2xl font-bold text-[#1a1a1a] tabular-nums">{formatCents(c.product.price, currency)}</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact information section */}
            <div className="space-y-3">
              <label className="text-[13px] font-medium text-[#1a1a1a]">{t.contactInfo}</label>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#525252]">{t.email}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => validateField("email", email)} placeholder={t.emailPlaceholder} required className={`checkout-input ${inputClass(!!fieldErrors.email)}`} />
                {fieldErrors.email && <p className="text-[11px] text-[#ef4444] animate-in slide-in-from-top-1 duration-150">{fieldErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#525252]">{t.whatsapp}</label>
                <div className="flex gap-2">
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="checkout-select-trigger w-[110px] h-10 rounded-lg bg-white border-[#d4d4d8] text-[#1a1a1a] text-xs shrink-0">
                      <SelectValue>{selectedEntry ? `${selectedEntry.flag} ${selectedEntry.code}` : "+55"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {COUNTRY_CODES.map((cc) => (
                        <SelectItem key={cc.country} value={cc.country}>
                          {cc.flag} {cc.code} ({cc.label})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => validateField("phone", phone)} placeholder={t.phonePlaceholder} required className={`checkout-input ${inputClass(!!fieldErrors.phone)} flex-1`} />
                </div>
                {fieldErrors.phone && <p className="text-[11px] text-[#ef4444] animate-in slide-in-from-top-1 duration-150">{fieldErrors.phone}</p>}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#e4e4e7]" />
              <span className="text-[11px] text-[#a3a3a3] whitespace-nowrap">{t.orPayWithCard}</span>
              <div className="flex-1 h-px bg-[#e4e4e7]" />
            </div>

            {/* Card information section - grouped fields */}
            <div className="space-y-3">
              <label className="text-[13px] font-medium text-[#1a1a1a]">{t.cardDetails}</label>
              <div className="rounded-lg border border-[#d4d4d8] overflow-hidden">
                <div className="checkout-card-field h-10 bg-white px-3 flex items-center transition-all duration-150 border-b border-[#d4d4d8]">
                  <CardNumberElement options={{ style: CARD_STYLE, placeholder: t.cardNumber }} onChange={(e) => setCardError(e.error?.message || null)} className="w-full" />
                </div>
                <div className="grid grid-cols-2">
                  <div className="checkout-card-field h-10 bg-white px-3 flex items-center transition-all duration-150 border-r border-[#d4d4d8]">
                    <CardExpiryElement options={{ style: CARD_STYLE, placeholder: t.expiry }} className="w-full" />
                  </div>
                  <div className="checkout-card-field h-10 bg-white px-3 flex items-center transition-all duration-150">
                    <CardCvcElement options={{ style: CARD_STYLE, placeholder: t.cvc }} className="w-full" />
                  </div>
                </div>
              </div>
              {cardError && <p className="text-xs text-[#ef4444]">{cardError}</p>}
            </div>

            {/* Cardholder name */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#1a1a1a]">{t.cardholderName}</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} onBlur={() => validateField("name", customerName)} placeholder={t.cardholderNamePlaceholder} required className={`checkout-input ${inputClass(!!fieldErrors.name)}`} />
              {fieldErrors.name && <p className="text-[11px] text-[#ef4444] animate-in slide-in-from-top-1 duration-150">{fieldErrors.name}</p>}
            </div>

            {/* Mobile bumps */}
            {c.bump_products.length > 0 && (
              <div className="lg:hidden space-y-3">
                {c.bump_products.map(renderBumpCard)}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-12 font-bold text-sm rounded-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center"
              style={{ backgroundColor: pc, color: '#fff' }}
              disabled={processing || success || !stripe || !customerName.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 8}
            >
              {success ? (
                <CheckCircle2 className="h-5 w-5 animate-in zoom-in duration-200" strokeWidth={2} />
              ) : processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  {c.cta_text || t.defaultCta} — {formatCents(totalAmount(), currency)}
                </>
              )}
            </button>

            <p className="text-[11px] text-[#a3a3a3] text-center">🔒 {t.securePayment}</p>
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
  const [detectedLang, setDetectedLang] = useState<CheckoutLang>("pt");

  useEffect(() => {
    async function load() {
      if (!slug) return;
      const { data, error } = await supabase.from("checkouts").select("*, products!checkouts_product_id_fkey(id, name, description, price, currency, image_url)").eq("checkout_slug", slug).eq("active", true).maybeSingle();
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      const { data: bumpsData } = await supabase.from("checkout_order_bumps").select("product_id, sort_order, description, products(id, name, description, price, currency)").eq("checkout_id", data.id).order("sort_order");
      const bumpProducts: BumpProduct[] = (bumpsData as any[] || []).filter((b: any) => b.products).map((b: any) => ({
        id: b.products.id,
        name: b.products.name,
        description: b.products.description || null,
        price: b.products.price,
        currency: b.products.currency || "eur",
        bump_description: b.description || null,
      }));
      setCheckout({
        ...data,
        primary_color: data.primary_color || "#2563eb",
        accent_color: data.accent_color || "#1e40af",
        bg_color: data.bg_color || "#09090b",
        cta_text: data.cta_text || "Finalizar compra",
        show_product_image: data.show_product_image ?? true,
        first_offer_id: data.first_offer_id,
        product: data.products as any,
        bump_products: bumpProducts,
        countdown_enabled: data.countdown_enabled ?? false,
        countdown_duration: data.countdown_duration ?? 10,
        countdown_text: data.countdown_text ?? "Essa oferta expira em:",
        countdown_bg_color: data.countdown_bg_color ?? "#dc2626",
        countdown_text_color: data.countdown_text_color ?? "#ffffff",
        social_proof_enabled: data.social_proof_enabled ?? false,
        social_proof_messages: (Array.isArray(data.social_proof_messages) ? data.social_proof_messages : []) as string[],
        social_proof_interval: data.social_proof_interval ?? 15,
        social_proof_display_duration: data.social_proof_display_duration ?? 5,
        social_proof_position: (data.social_proof_position as "bottom-left" | "bottom-right") ?? "bottom-left",
      });
      setLoading(false);
    }
    load();
  }, [slug]);

  // Detect language from geolocation
  useEffect(() => {
    async function detectLang() {
      try {
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        if (data?.country_code) {
          setDetectedLang(getLangFromCountry(data.country_code));
        }
      } catch {
        try {
          const region = (navigator.language || "pt-BR").split("-")[1]?.toUpperCase();
          if (region) setDetectedLang(getLangFromCountry(region));
          else {
            const langPrefix = (navigator.language || "pt").split("-")[0].toLowerCase();
            const langMap: Record<string, CheckoutLang> = { pt: "pt", en: "en", es: "es", fr: "fr", de: "de", it: "it", nl: "nl" };
            if (langMap[langPrefix]) setDetectedLang(langMap[langPrefix]);
          }
        } catch {}
      }
    }
    detectLang();
  }, []);

  const t = getTranslations(detectedLang);
  const stripeLocale = getStripeLocale(detectedLang);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-[#a3a3a3]" /></div>;

  if (notFound || !checkout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <h1 className="text-lg font-bold text-[#1a1a1a]">{t.notFound}</h1>
          <p className="text-[13px] text-[#a3a3a3]">{t.notFoundDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ locale: stripeLocale as any }}>
      <CheckoutForm checkout={checkout} lang={detectedLang} t={t} />
    </Elements>
  );
}
