import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
import { Loader2, Lock, CheckCircle2, Smartphone, Timer, AlertCircle, CreditCard, ChevronDown, User, Mail, Phone, ShoppingCart, Shield, Info, X } from "lucide-react";
import { COUNTRY_CODES, COUNTRY_TO_DDI } from "@/lib/countryCodes";
import { CheckoutCountdownBar } from "@/components/CheckoutCountdownBar";
import { SalesNotificationPopup } from "@/components/SalesNotificationPopup";
import { getLangFromCountry, getTranslations, getStripeLocale, type CheckoutLang, type CheckoutTranslations } from "@/lib/checkoutTranslations";
import PixelInjector from "@/components/PixelInjector";

const stripePromise = loadStripe("pk_live_51T9VKyGfpSpNOdDI6GT8Bq78Kn7NagZZuB880xuOksJD8TPAfOFIZ762lhXVg3EbJIcf66uoOvdweVF4kjrkCU3700yfUxyd0d");

function useDocTitle(title: string) {
  useEffect(() => { document.title = title; return () => { document.title = "Yocota"; }; }, [title]);
}

interface BumpProduct { id: string; name: string; description: string | null; price: number; currency: string; bump_description: string | null; }
interface CheckoutData {
  id: string; name: string; checkout_slug: string; redirect_url: string; product_id: string;
  primary_color: string; accent_color: string; bg_color: string; cta_button_color: string | null;
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
  // Tracking pixels
  fb_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  google_ads_id: string | null;
  google_ads_label: string | null;
  gtm_id: string | null;
}

// Country → ISO 4217 currency code (Stripe checkout only — not used for MZN/Débito)
const COUNTRY_CURRENCY: Record<string, string> = {
  US:"usd",CA:"cad",GB:"gbp",AU:"aud",NZ:"nzd",JP:"jpy",CN:"cny",KR:"krw",
  IN:"inr",SG:"sgd",HK:"hkd",CH:"chf",NO:"nok",SE:"sek",DK:"dkk",PL:"pln",
  CZ:"czk",HU:"huf",RO:"ron",ZA:"zar",BR:"brl",MX:"mxn",AR:"ars",CO:"cop",
  CL:"clp",PE:"pen",MZ:"mzn",AO:"aoa",NG:"ngn",KE:"kes",EG:"egp",MA:"mad",
  GH:"ghs",TN:"tnd",TZ:"tzs",UG:"ugx",RU:"rub",TR:"try",SA:"sar",AE:"aed",
  // Euro-zone
  FR:"eur",DE:"eur",IT:"eur",ES:"eur",PT:"eur",NL:"eur",BE:"eur",AT:"eur",
  FI:"eur",IE:"eur",SK:"eur",SI:"eur",LV:"eur",LT:"eur",EE:"eur",MT:"eur",
  LU:"eur",CY:"eur",GR:"eur",
};

function CheckoutForm({ checkout: c, detectedCountry }: { checkout: CheckoutData; detectedCountry: string }) {
  const stripe = useStripe();
  const elements = useElements();

  const isMZN = c.product.currency?.toUpperCase() === "MZN";

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(isMZN ? "MZ" : (detectedCountry || "BR"));
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "debito">(isMZN ? "debito" : "stripe");
  const [walletType, setWalletType] = useState<"mpesa" | "emola">("mpesa");
  const [msisdn, setMsisdn] = useState("");
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalCountdown, setModalCountdown] = useState(120);
  const [lastOrderDetails, setLastOrderDetails] = useState<{ id: string, ref: string } | null>(null);
  const [orderStatus, setOrderStatus] = useState<"pending" | "paid" | "failed" | "timeout" | "checking">("pending");
  // Display currency + exchange rate state (Stripe only, reactive to country selector)
  const [displayCurrency, setDisplayCurrency] = useState<string>((c.product.currency || "eur").toLowerCase());
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // Refs to track latest values inside closures and event listeners
  const orderStatusRef = useRef(orderStatus);
  const lastOrderDetailsRef = useRef(lastOrderDetails);
  const modalOpenTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => { orderStatusRef.current = orderStatus; }, [orderStatus]);
  useEffect(() => { lastOrderDetailsRef.current = lastOrderDetails; }, [lastOrderDetails]);

  const pc = c.primary_color || "#2b6eff";

  useDocTitle(c.product.name ? `${c.product.name} — Checkout` : "Checkout");

  const selectedEntry = COUNTRY_CODES.find((cc) => cc.country === selectedCountry);
  const ddi = selectedEntry?.code || "+258";

  // ── Reactive language — updates automatically when user changes country ──
  const lang = getLangFromCountry(selectedCountry);
  const t    = getTranslations(lang);

  // ── Auto-currency conversion (Stripe only) ──
  useEffect(() => {
    if (isMZN) return;
    const productCurrency = (c.product.currency || "eur").toLowerCase();
    const userCurrency    = (COUNTRY_CURRENCY[selectedCountry] || productCurrency).toLowerCase();
    setDisplayCurrency(userCurrency);
    if (userCurrency === productCurrency) { setExchangeRate(1); return; }
    let cancelled = false;
    fetch(`https://open.er-api.com/v6/latest/${productCurrency.toUpperCase()}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const rate = data?.rates?.[userCurrency.toUpperCase()];
        if (rate) setExchangeRate(rate);
        else { setDisplayCurrency(productCurrency); setExchangeRate(1); }
      })
      .catch(() => { setDisplayCurrency(productCurrency); setExchangeRate(1); });
    return () => { cancelled = true; };
  }, [selectedCountry, isMZN, c.product.currency]);

  // Raw fetch status check — uses same approach as initiate (proven to work)
  // Called by polling interval and visibilitychange handler
  const checkPaymentStatus = useCallback(async () => {
    const details = lastOrderDetailsRef.current;
    if (!details?.ref || details.ref === 'pending') return;
    if (orderStatusRef.current !== "pending") return;
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${supabaseUrl}/functions/v1/process-debito-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ action: "status", debito_reference: details.ref })
      });
      const statusData = await resp.json();
      if (orderStatusRef.current !== "pending") return;
      if (statusData?.status === "SUCCESS" || statusData?.status === "PAID") {
        setOrderStatus("paid");
        setTimeout(() => {
          const successUrl = c.first_offer_id
            ? `/success/${c.id}?order_id=${details.id}&debito_reference=${details.ref}`
            : `${c.redirect_url}${c.redirect_url.includes("?") ? "&" : "?"}order_id=${details.id}&debito_reference=${details.ref}`;
          window.location.href = successUrl;
        }, 800);
      } else if (statusData?.status === "FAILED") {
        setOrderStatus("failed");
      }
    } catch (e) { console.warn("Status check exception:", e); }
  }, [c.first_offer_id, c.id, c.redirect_url]);

  // Date-based countdown timer — NOT affected by browser throttling in background
  useEffect(() => {
    let timer: any;
    if (showPaymentModal && orderStatus === "pending") {
      modalOpenTimeRef.current = Date.now();
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - modalOpenTimeRef.current) / 1000);
        const remaining = Math.max(0, 120 - elapsed);
        setModalCountdown(remaining);
        if (remaining <= 0) { clearInterval(timer); setOrderStatus("timeout"); }
      }, 500);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [showPaymentModal, orderStatus]);

  // Polling — every 3s while pending
  useEffect(() => {
    let pollInterval: any;
    let cancelled = false;
    if (showPaymentModal && lastOrderDetails?.ref && lastOrderDetails.ref !== 'pending' && orderStatus === "pending") {
      pollInterval = setInterval(async () => {
        if (orderStatusRef.current !== "pending" || cancelled) { clearInterval(pollInterval); return; }
        await checkPaymentStatus();
      }, 3000);
    }
    return () => { cancelled = true; if (pollInterval) clearInterval(pollInterval); };
  }, [showPaymentModal, lastOrderDetails, orderStatus, checkPaymentStatus]);

  // visibilitychange — check immediately when user returns to tab after approving on phone
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && orderStatusRef.current === "pending") {
        checkPaymentStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkPaymentStatus]);

  const totalAmount = () => {
    let total = c.product.price;
    c.bump_products.forEach((bp) => { if (selectedBumps.has(bp.id)) total += bp.price; });
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) { toast.error(t.fillAllFields); return; }
    setProcessing(true);
    const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");
    const fullPhone = `${ddi}${phone.replace(/\D/g, "")}`;
    const bumpIdsArray = Array.from(selectedBumps);

    if (paymentMethod === "debito") {
      if (!msisdn) { toast.error(t.fillAllFields); setProcessing(false); return; }
      
      // Abrimos o modal primeiro para dar feedback visual imediato
      setShowPaymentModal(true); 
      setOrderStatus("pending"); 
      setModalCountdown(120);
      
      try {
        console.log("Iniciando fetch nativo para process-debito-payment para evitar bloqueio do Supabase...");
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        // Cancela qualquer fetch anterior e cria novo controlador
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch(`${supabaseUrl}/functions/v1/process-debito-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({ 
            action: "initiate", checkout_id: c.id, customer_name: customerName, 
            customer_email: email, customer_phone: fullPhone, wallet_type: walletType, 
            msisdn, selected_bump_ids: bumpIdsArray, utm_data: utms, amount: totalAmount() / 100 
          })
        });

        if (!response.ok) {
          if (response.status === 504 || response.status === 502) {
            throw new Error(`A operadora (${walletType}) não está a responder no momento (timeout). Verifique se o telemóvel tem sinal e tente de novo.`);
          }
          throw new Error(`Falha técnica no servidor de pagamentos: Erro ${response.status}`);
        }

        const debitoData = await response.json();

        if (!debitoData?.success) {
          console.error("Erro retornado pela função:", debitoData?.error);
          setShowPaymentModal(false);
          throw new Error(debitoData?.error || "Ocorreu um erro ao processar o pagamento.");
        }

        if (debitoData?.status === "SUCCESS") {
          setOrderStatus("paid");
          setTimeout(() => {
            if (c.first_offer_id) {
              window.location.href = `/success/${c.id}?order_id=${debitoData.order_id}&debito_reference=${debitoData.debito_reference}`;
            } else {
              const base = c.redirect_url.startsWith("http") ? c.redirect_url : `https://${c.redirect_url}`;
              window.location.href = `${base}${base.includes("?") ? "&" : "?"}order_id=${debitoData.order_id}&debito_reference=${debitoData.debito_reference}`;
            }
          }, 800);
        } else {
          setLastOrderDetails({ id: debitoData.order_id, ref: debitoData.debito_reference });
        }
      } catch (err: any) {
        // Se o utilizador cancelou (clicou X), ignorar silenciosamente
        if (err.name === 'AbortError') { setProcessing(false); return; }
        console.error("Catch no CheckoutPage:", err);
        toast.error(err.message || "Compra cancelada", { duration: 5000 });
        setShowPaymentModal(false);
      } finally {
        setProcessing(false);
      }
      return;
    }

    try {
      const { data: intentData, error: intentError } = await supabase.functions.invoke("create-intent", {
        body: { checkout_id: c.id, customer_name: customerName, customer_email: email, customer_phone: fullPhone, selected_bump_ids: bumpIdsArray, utm_data: utms },
      });
      if (intentError || !intentData?.client_secret) throw new Error("Erro ao iniciar Stripe");
      const cardEl = elements?.getElement(CardNumberElement);
      if (!cardEl || !stripe) throw new Error("Erro ao carregar Stripe");
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(intentData.client_secret, {
        payment_method: { card: cardEl, billing_details: { name: customerName, email, phone: fullPhone } },
      });
      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent?.status === "succeeded") {
        setTimeout(() => {
          if (c.first_offer_id) {
            window.location.href = `/success/${c.id}?payment_intent_id=${paymentIntent.id}&order_id=${intentData.order_id}`;
          } else {
            window.location.href = c.redirect_url.startsWith("http") ? c.redirect_url : `https://${c.redirect_url}`;
          }
        }, 800);
      }
    } catch (err: any) { console.error("Stripe error:", err); toast.error(err.message || "Compra cancelada"); } finally { setProcessing(false); }
  };

  const currency = (c.product.currency || "eur").toLowerCase();
  const currencyStr = isMZN ? "MZN" : (displayCurrency || currency).toUpperCase();
  // Apply exchange rate for display (displayCurrency may differ from product currency)
  const baseFormattedPrice = formatCents(Math.round(c.product.price * exchangeRate), displayCurrency || currency);
  const formattedPrice     = formatCents(Math.round(totalAmount() * exchangeRate), displayCurrency || currency);
  const labelClass = "block text-[11.5px] font-semibold text-[#1F2937] mb-0.5";
  const fieldWrap = "relative flex items-center h-[39px] rounded-lg border border-[#D1D5DB] bg-white overflow-hidden focus-within:border-[#22C55E] focus-within:shadow-[0_0_0_2px_rgba(34,197,94,0.08)] transition-all";
  const fieldInput = "flex-1 h-full bg-transparent text-[12.5px] text-[#1F2937] placeholder-[#9CA3AF] outline-none border-none ring-0 px-2";
  const iconWrap = "pl-2.5 pr-1.5 text-[#9CA3AF] flex-shrink-0";
  return (
    <div className="min-h-screen font-sans selection:bg-green-100 flex flex-col" style={{ backgroundColor: c.bg_color || "#f9fafb" }}>
      {c.countdown_enabled && <CheckoutCountdownBar checkoutId={c.id} durationMinutes={c.countdown_duration} text={c.countdown_text} expiredText={c.countdown_expired_text} bgColor={c.countdown_bg_color} textColor={c.countdown_text_color} />}

      {/* ── Banner: outside padded container, same max-w but no horizontal padding ── */}
      {c.banner_url && (
        <div className="w-full max-w-[420px] mx-auto overflow-hidden shadow-sm">
          <img src={c.banner_url} className="w-full h-auto object-cover block" alt="" />
        </div>
      )}

      <div className={`flex-1 flex flex-col justify-start ${c.banner_url ? "pt-4" : "pt-2"} pb-4`}>
      <div className="max-w-[420px] mx-auto w-full px-4 sm:px-5 space-y-4">


        {/* ── Product Summary Card ── */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm px-4 py-3 flex items-center gap-3">
          {c.show_product_image && c.product.image_url && (
            <div className="w-[68px] h-[68px] rounded-xl overflow-hidden shrink-0 border border-[#F3F4F6]">
              <img src={c.product.image_url} alt={c.product.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-[#1F2937] leading-snug line-clamp-2">
              {c.headline_text || c.product.name}
            </h1>
            <div className="text-[20px] font-extrabold leading-tight mt-1" style={{ color: c.cta_button_color || "#00B589" }}>
              {formattedPrice}
            </div>
          </div>
          {isMZN ? (
            <span className="text-2xl shrink-0 select-none">🇲🇿</span>
          ) : (
            /* Stripe: country/DDD selector lives here */
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="border-0 shadow-none bg-transparent focus:ring-0 gap-0.5 w-auto h-auto p-0 shrink-0 [&>svg]:hidden">
                <div className="flex items-center gap-1 cursor-pointer">
                  <span className="text-[26px] leading-none">{selectedEntry?.flag}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#9CA3AF]" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {COUNTRY_CODES.map(cc => <SelectItem key={cc.country} value={cc.country}>{cc.flag} {cc.code}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome completo — apenas para fluxo MZN (Débito) */}
          {isMZN && (
            <div>
              <label className={labelClass}>Nome completo <span className="text-[#EF4444]">*</span></label>
              <div className={fieldWrap}>
                <span className="pl-2.5 pr-1.5 text-[#9CA3AF] flex-shrink-0"><User className="h-4 w-4" strokeWidth={1.5} /></span>
                <input type="text" placeholder="Nome completo" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={fieldInput} required />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className={labelClass}>Email <span className="text-[#6B7280] font-normal text-[11px]">(opcional)</span></label>
            <div className={fieldWrap}>
              <span className="pl-2.5 pr-1.5 text-[#9CA3AF] flex-shrink-0"><Mail className="h-4 w-4" strokeWidth={1.5} /></span>
              <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldInput} />
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
                  <span className="text-[13px] font-semibold text-[#1F2937] pr-2 border-r border-[#E5E7EB] mr-1 select-none">+258</span>
                  <input type="tel" placeholder="84 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldInput} required />
                </>
              ) : (
                /* Code shown as static text — country selected in product card */
                <>
                  <span className="text-[13px] font-semibold text-[#1F2937] pr-2 border-r border-[#E5E7EB] mr-1 select-none">{selectedEntry?.code}</span>
                  <input type="tel" placeholder="Número" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldInput} required />
                </>
              )}
            </div>
          </div>

          {/* Order bumps */}
          {c.bump_products.length > 0 && (
            <div className="space-y-3">
              <label className={labelClass}>Ofertas especiais</label>
              {c.bump_products.map((bp) => (
                <div key={bp.id} onClick={() => {
                  const newSet = new Set(selectedBumps);
                  if (newSet.has(bp.id)) newSet.delete(bp.id);
                  else newSet.add(bp.id);
                  setSelectedBumps(newSet);
                }} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${selectedBumps.has(bp.id) ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#D1D5DB] bg-white"}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedBumps.has(bp.id) ? "bg-[#22C55E] border-[#22C55E]" : "border-[#D1D5DB] bg-white"}`}>
                    {selectedBumps.has(bp.id) && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[16px] font-semibold text-[#1F2937] leading-tight">{bp.name}</span>
                      <span className="text-[13px] font-semibold shrink-0" style={{ color: c.cta_button_color || "#00B589" }}>+{formatCents(Math.round(bp.price * exchangeRate), displayCurrency || bp.currency)}</span>
                    </div>
                    <p className="text-[13px] text-[#6B7280] mt-1 leading-relaxed">{bp.bump_description || bp.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagamento MZN — INTACTO */}
          {isMZN ? (
            <>
              {/* Cards de método */}
              <div>
                <label className={labelClass}>Selecione o método de pagamento <span className="text-[#EF4444]">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {/* e-Mola */}
                  <button type="button" onClick={() => setWalletType("emola")}
                    className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all gap-1 ${walletType === "emola" ? "bg-[#F0FDF4] border-[#22C55E]" : "bg-white border-[#D1D5DB]"}`}>
                    <div className="flex items-center gap-1.5 w-full">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${walletType === "emola" ? "border-[#3B82F6] bg-[#3B82F6]" : "border-[#D1D5DB]"}`}>
                        {walletType === "emola" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <img src="/assets/emola-logo.png" className="h-6 object-contain flex-1" alt="e-Mola" />
                    </div>
                    <span className="text-[11px] font-medium text-[#1F2937]">e-Mola</span>
                  </button>
                  {/* M-Pesa */}
                  <button type="button" onClick={() => setWalletType("mpesa")}
                    className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all gap-1 ${walletType === "mpesa" ? "bg-[#F0FDF4] border-[#22C55E]" : "bg-white border-[#D1D5DB]"}`}>
                    <div className="flex items-center gap-1.5 w-full">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${walletType === "mpesa" ? "border-[#3B82F6] bg-[#3B82F6]" : "border-[#D1D5DB]"}`}>
                        {walletType === "mpesa" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <img src="/assets/mpesa-logo.png" className="h-6 object-contain flex-1" alt="M-Pesa" />
                    </div>
                    <span className="text-[11px] font-medium text-[#1F2937]">M-Pesa</span>
                  </button>
                </div>
              </div>
              {/* Número da carteira */}
              <div>
                <label className={labelClass}>Número {walletType === "emola" ? "e-Mola" : "M-Pesa"} <span className="text-[#EF4444]">*</span></label>
                <div className={fieldWrap}>
                  <span className="pl-2.5 pr-1.5 text-[#9CA3AF] flex-shrink-0"><Phone className="h-4 w-4" strokeWidth={1.5} /></span>
                  <span className="text-[13px] font-semibold text-[#1F2937] pr-2 border-r border-[#E5E7EB] mr-1 select-none">+258</span>
                  <input type="tel" placeholder={walletType === "emola" ? "86 12 34 567" : "84 12 34 567"} value={msisdn} onChange={(e) => setMsisdn(e.target.value)} maxLength={9} className={fieldInput} required />
                </div>
              </div>
            </>
          ) : (
            /* ── Stripe: Informações do cartão → Nome no cartão ── */
            <>
              <div>
                <label className={labelClass}><CreditCard size={14} className="inline mr-1.5 -mt-0.5" />Informações do cartão <span className="text-[#EF4444]">*</span></label>
                <div className="space-y-2">
                  <div className="flex items-center h-[39px] rounded-lg border border-[#D1D5DB] bg-white px-3 focus-within:border-[#22C55E] transition-colors">
                    <CardNumberElement options={{ style: { base: { fontSize: '13.5px', color: '#1F2937', '::placeholder': { color: '#9CA3AF' } } } }} className="flex-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center h-[39px] rounded-lg border border-[#D1D5DB] bg-white px-3 focus-within:border-[#22C55E] transition-colors">
                      <CardExpiryElement options={{ style: { base: { fontSize: '13.5px', color: '#1F2937', '::placeholder': { color: '#9CA3AF' } } } }} className="flex-1" />
                    </div>
                    <div className="flex items-center h-[39px] rounded-lg border border-[#D1D5DB] bg-white px-3 focus-within:border-[#22C55E] transition-colors">
                      <CardCvcElement options={{ style: { base: { fontSize: '13.5px', color: '#1F2937', '::placeholder': { color: '#9CA3AF' } } } }} className="flex-1" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Nome no cartão */}
              <div>
                <label className={labelClass}>Nome no cartão <span className="text-[#EF4444]">*</span></label>
                <div className={fieldWrap}>
                  <span className="pl-2.5 pr-1.5 text-[#9CA3AF] flex-shrink-0"><User className="h-4 w-4" strokeWidth={1.5} /></span>
                  <input type="text" placeholder="Nome como aparece no cartão" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={fieldInput} required />
                </div>
              </div>
            </>
          )}


          {/* CTA + Trust badges + Security footer */}
          <div className="pt-0.5 space-y-2">
            <button type="submit" disabled={processing}
              className="w-full h-[47px] rounded-xl font-semibold text-[15.5px] text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-md hover:brightness-105"
              style={{ backgroundColor: c.cta_button_color || "#00B589" }}>
              {processing
                ? <Loader2 className="animate-spin h-5 w-5" />
                : <><ShoppingCart size={19} strokeWidth={2} /><span>{c.cta_text || t.defaultCta} — {formattedPrice}</span></>}
            </button>
            <div className="flex items-center justify-center gap-4 text-[11.5px] text-[#6B7280]">
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-[#22C55E]" strokeWidth={2} />{t.securePayment.includes("Stripe") ? "Compra 100% segura" : t.securePayment.split(" ").slice(0,3).join(" ")}</span>
              <span className="text-[#D1D5DB]">|</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-[#22C55E]" strokeWidth={2} />Entrega imediata</span>
            </div>
            {/* Security & legal footer */}
            <div className="text-center space-y-1 pt-1 border-t border-[#F3F4F6]">
              <p className="text-[10px] text-[#9CA3AF] leading-relaxed px-2 pt-1">
                Nós protegemos seus dados de pagamento com criptografia para garantir a sua segurança.
              </p>
              <div className="flex items-center justify-center gap-2 text-[10px] text-[#9CA3AF]">
                <span>Terms</span>
                <span className="text-[#D1D5DB]">•</span>
                <span>Privacy</span>
              </div>
            </div>
          </div>
        </form>
      </div>
      </div>{/* /flex-1 justify-center */}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-[320px] sm:max-w-sm rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-3xl border animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`p-5 rounded-full ${orderStatus === "paid" ? "bg-green-100" : (orderStatus === "timeout" ? "bg-red-100" : "bg-blue-50")}`}>
                {orderStatus === "paid" ? <CheckCircle2 className="w-10 h-10 text-green-600" /> :
                 orderStatus === "timeout" ? <AlertCircle className="w-10 h-10 text-red-600" /> :
                 <Smartphone className="w-10 h-10 text-[#2b6eff]" />}
              </div>

              {orderStatus === "pending" ? (
                <div className="w-full flex flex-col items-center gap-1">
                  <div className="space-y-2 text-center">
                    <h3 className="text-lg font-bold text-black">Confirme o pagamento</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Em breve aparecerá um banner no seu dispositivo para inserir o PIN e confirmar o pagamento de <span className="font-bold text-black">{formattedPrice}</span>
                    </p>
                  </div>
                  <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 rounded-xl mt-1">
                    <Timer size={18} className="text-gray-400" />
                    <span className="font-bold text-xl text-black tabular-nums">{Math.floor(modalCountdown / 60)}:{(modalCountdown % 60).toString().padStart(2, '0')}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-black">
                    {orderStatus === "paid" ? "Sucesso!" :
                     orderStatus === "checking" ? "A verificar..." :
                     "Tempo esgotado"}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {orderStatus === "paid" ? "Pagamento confirmado. Redirecionando..." :
                     orderStatus === "checking" ? "A consultar o estado do pagamento..." :
                     "Inseriu o PIN depois do tempo? Clique em verificar."}
                  </p>
                </div>
              )}

              {orderStatus === "timeout" && lastOrderDetails?.ref && (
                <button
                  onClick={async () => {
                    // Use raw fetch directly — avoids stale ref and SDK issues
                    setOrderStatus("checking");
                    try {
                      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                      const resp = await fetch(`${supabaseUrl}/functions/v1/process-debito-payment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseAnonKey}` },
                        body: JSON.stringify({ action: "status", debito_reference: lastOrderDetails.ref })
                      });
                      const statusData = await resp.json();
                      if (statusData?.status === "SUCCESS" || statusData?.status === "PAID") {
                        setOrderStatus("paid");
                        setTimeout(() => {
                          const successUrl = c.first_offer_id
                            ? `/success/${c.id}?order_id=${lastOrderDetails.id}&debito_reference=${lastOrderDetails.ref}`
                            : `${c.redirect_url}${c.redirect_url.includes("?") ? "&" : "?"}order_id=${lastOrderDetails.id}&debito_reference=${lastOrderDetails.ref}`;
                          window.location.href = successUrl;
                        }, 800);
                      } else {
                        setOrderStatus("timeout"); // back to timeout — payment not confirmed yet
                      }
                    } catch { setOrderStatus("timeout"); }
                  }}
                  className="w-full py-4 rounded-xl font-bold text-white"
                  style={{ backgroundColor: c.primary_color || "#2b6eff" }}
                >
                  Verificar pagamento
                </button>
              )}
              {(orderStatus === "failed" || (orderStatus === "timeout" && !lastOrderDetails?.ref)) && (
                <button onClick={() => setShowPaymentModal(false)} className="w-full py-4 rounded-xl bg-black text-white font-bold">Fechar</button>
              )}
              {orderStatus === "checking" && (
                <div className="w-full flex items-center justify-center gap-2 py-3">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {c.social_proof_enabled && c.social_proof_messages.length > 0 && (
        <SalesNotificationPopup
          messages={c.social_proof_messages}
          intervalSeconds={c.social_proof_interval || 30}
          displayDurationSeconds={c.social_proof_display_duration || 5}
          position={c.social_proof_position || "bottom-left"}
        />
      )}

      {/* Tracking Pixels — ViewContent on checkout load */}
      <PixelInjector
        pixels={{
          fb_pixel_id: c.fb_pixel_id,
          tiktok_pixel_id: c.tiktok_pixel_id,
          google_ads_id: c.google_ads_id,
          google_ads_label: c.google_ads_label,
          gtm_id: c.gtm_id,
        }}
        event="view"
        productName={c.product.name}
      />
    </div>
  );
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Detect country from browser locale; refined by IP geolocation
  const [detectedCountry, setDetectedCountry] = useState<string>(() =>
    navigator.language.split("-")[1]?.toUpperCase() || "US"
  );

  // Capturar UTMs e parâmetros de rastreamento da URL → sessionStorage para envio ao UTMify
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck"];
    const utmData: Record<string, string> = {};
    trackingKeys.forEach((key) => {
      const val = params.get(key);
      if (val) utmData[key] = val;
    });
    if (Object.keys(utmData).length > 0) {
      sessionStorage.setItem("checkout_utms", JSON.stringify(utmData));
    }
  }, []);

  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(d => { if (d?.country_code) setDetectedCountry(d.country_code); })
      .catch(() => {}); // graceful fallback to browser locale
  }, []);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      
      // Busca o checkout e os bumps associados com join nos produtos
      const { data, error } = await supabase
        .from("checkouts")
        .select(`
          *,
          products!checkouts_product_id_fkey(*),
          checkout_order_bumps(
            description,
            products(*)
          )
        `)
        .eq("checkout_slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      // Mapeia os bumps para o formato da interface
      const bumps = (data.checkout_order_bumps as any[])?.map((b: any) => ({
        id: b.products.id,
        name: b.products.name,
        description: b.products.description,
        price: b.products.price,
        currency: b.products.currency,
        bump_description: b.description
      })) || [];

      setCheckout({ 
        ...data, 
        product: data.products as any, 
        bump_products: bumps,
        social_proof_messages: (Array.isArray(data.social_proof_messages) ? data.social_proof_messages : []) as string[],
        social_proof_position: (data.social_proof_position as "bottom-left" | "bottom-right") || "bottom-left"
      });
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (notFound || !checkout) return <div className="min-h-screen flex items-center justify-center bg-white font-bold text-gray-200 uppercase">Offline</div>;

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm checkout={checkout} detectedCountry={detectedCountry} />
    </Elements>
  );
}
