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
import { Loader2, Lock, CheckCircle2, Smartphone, Timer, AlertCircle, CreditCard, ChevronDown } from "lucide-react";
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
}

function CheckoutForm({ checkout: c, lang, t, detectedCountry }: { checkout: CheckoutData; lang: CheckoutLang; t: CheckoutTranslations; detectedCountry: string }) {
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

  // Refs to track latest values inside closures and event listeners
  const orderStatusRef = useRef(orderStatus);
  const lastOrderDetailsRef = useRef(lastOrderDetails);
  const modalOpenTimeRef = useRef<number>(0);
  useEffect(() => { orderStatusRef.current = orderStatus; }, [orderStatus]);
  useEffect(() => { lastOrderDetailsRef.current = lastOrderDetails; }, [lastOrderDetails]);

  const pc = c.primary_color || "#2b6eff";

  useDocTitle(c.product.name ? `${c.product.name} — Checkout` : "Checkout");

  const selectedEntry = COUNTRY_CODES.find((cc) => cc.country === selectedCountry);
  const ddi = selectedEntry?.code || "+258";

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
    if (!customerName.trim() || !email.trim()) { toast.error(t.fillAllFields); return; }
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

        const response = await fetch(`${supabaseUrl}/functions/v1/process-debito-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
          },
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

  const currencyStr = isMZN ? "MTn" : c.product.currency;
  const formattedPrice = (totalAmount() / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 }).replace('.', ',') + " " + currencyStr;
  const inputClass = "bg-[#f4f7fa] border-[#27272a] text-black h-10 rounded-lg mb-3 focus-visible:ring-0 focus:ring-0 focus:border-black transition-all outline-none";
  const labelClass = "text-[13px] font-bold text-black mb-1.5 block";
  return (
    <div className="min-h-screen font-sans text-black selection:bg-blue-100 flex flex-col justify-center py-6 sm:py-10" style={{ backgroundColor: c.bg_color || "#ffffff" }}>
      {c.countdown_enabled && <CheckoutCountdownBar checkoutId={c.id} durationMinutes={c.countdown_duration} text={c.countdown_text} bgColor={c.countdown_bg_color} textColor={c.countdown_text_color} />}
      
      <div className="max-w-[440px] mx-auto w-full space-y-5 px-4 sm:px-5">
        {c.banner_url && (
            <div className="w-full rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <img src={c.banner_url} className="w-full h-auto object-cover" />
            </div>
        )}

        <div className="space-y-1">
            <h1 className="text-[24px] font-bold text-black leading-tight">{c.headline_text || c.product.name}</h1>
            <div className="text-[28px] font-black text-black leading-none">{formattedPrice}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-[14px] font-bold text-black mb-3 block">Informações de contacto</Label>
            <div className="space-y-2">
                <div>
                    <Label className={labelClass}>Nome completo</Label>
                    <Input placeholder="Escreva aqui..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} required />
                </div>
                <div>
                    <Label className={labelClass}>Email</Label>
                    <Input placeholder="Escreva aqui..." type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                </div>
                <div>
                    <Label className={labelClass}>WhatsApp</Label>
                    <div className="flex gap-2">
                        <Select value={selectedCountry} onValueChange={setSelectedCountry} required>
                            <SelectTrigger className="w-[120px] h-10 rounded-lg border-[#27272a] bg-white focus:ring-0 flex items-center px-3">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[16px]">{selectedEntry?.flag}</span>
                                        <span className="text-[14px] font-medium text-black">{selectedEntry?.code}</span>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                                {COUNTRY_CODES.map(cc => <SelectItem key={cc.country} value={cc.country}>{cc.flag} {cc.code}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input placeholder="Número" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} flex-1`} required />
                    </div>
                </div>
            </div>
          </div>

          {c.bump_products.length > 0 && (
            <div className="space-y-3">
              <Label className={labelClass}>Ofertas especiais</Label>
              {c.bump_products.map((bp) => (
                <div key={bp.id} onClick={() => {
                  const newSet = new Set(selectedBumps);
                  if (newSet.has(bp.id)) newSet.delete(bp.id);
                  else newSet.add(bp.id);
                  setSelectedBumps(newSet);
                }} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 shadow-sm ${selectedBumps.has(bp.id) ? "border-[#2b6eff] bg-blue-50/30" : "border-[#27272a] bg-white"}`}>
                   <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedBumps.has(bp.id) ? "bg-[#2b6eff] border-[#2b6eff]" : "border-[#27272a] bg-white"}`}>
                      {selectedBumps.has(bp.id) && <CheckCircle2 size={12} className="text-white" />}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[13px] font-bold text-black leading-tight">{bp.name}</span>
                        <span className="text-[13px] font-black text-black shrink-0">+{formatCents(bp.price, bp.currency)}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{bp.bump_description || bp.description}</p>
                   </div>
                </div>
              ))}
            </div>
          )}

          {isMZN ? (
            <>
              <div>
                <Label className={labelClass}>Selecione a carteira</Label>
                <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setWalletType("mpesa")} className={`h-16 rounded-xl border-2 transition-all flex items-center justify-center p-3 shadow-sm ${walletType === "mpesa" ? "border-[#e31e27] bg-[#e31e27]" : "border-gray-100 bg-white opacity-40 grayscale"}`}>
                        <img src="/assets/mpesa-logo.png" className="h-10 object-contain" />
                    </button>
                    <button type="button" onClick={() => setWalletType("emola")} className={`h-16 rounded-xl border-2 transition-all flex items-center justify-center p-3 shadow-sm ${walletType === "emola" ? "border-[#f37227] bg-[#f37227]" : "border-gray-100 bg-white opacity-40 grayscale"}`}>
                        <img src="/assets/emola-logo.png" className="h-10 object-contain" />
                    </button>
                </div>
              </div>
              <div>
                <Label className={labelClass}>Número da Carteira (MZN)</Label>
                <Input placeholder="Introduza o número..." value={msisdn} onChange={(e) => setMsisdn(e.target.value)} maxLength={9} className={inputClass} required />
              </div>
            </>
          ) : (
            <div>
              <Label className={labelClass}><CreditCard size={14} className="inline mr-1.5" />Cartão de crédito</Label>
              <div className="space-y-2">
                <div className={`${inputClass} px-3 flex items-center`}>
                  <CardNumberElement options={{ style: { base: { fontSize: '14px', color: '#000', '::placeholder': { color: '#a1a1aa' } } } }} className="flex-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`${inputClass} px-3 flex items-center`}>
                    <CardExpiryElement options={{ style: { base: { fontSize: '14px', color: '#000', '::placeholder': { color: '#a1a1aa' } } } }} className="flex-1" />
                  </div>
                  <div className={`${inputClass} px-3 flex items-center`}>
                    <CardCvcElement options={{ style: { base: { fontSize: '14px', color: '#000', '::placeholder': { color: '#a1a1aa' } } } }} className="flex-1" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 space-y-3">
             <button type="submit" disabled={processing} className="w-full h-14 rounded-xl font-bold text-[16px] text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg" style={{ backgroundColor: c.cta_button_color || c.primary_color || "#2b6eff" }}>
                {processing ? <Loader2 className="animate-spin" /> : <><Lock size={16} /><span>{c.cta_text || "Finalizar compra"} — {formattedPrice}</span></>}
             </button>
             <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 font-medium">
                <Lock size={10} /><span>Pagamento processado com segurança{isMZN ? " via Débito" : " via Stripe"}</span>
             </div>
          </div>
        </form>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-[320px] sm:max-w-sm rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-3xl border animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className={`p-5 rounded-full ${orderStatus === "paid" ? "bg-green-100" : (orderStatus === "timeout" ? "bg-red-100" : "bg-blue-50")}`}>
                {orderStatus === "paid" ? <CheckCircle2 className="w-10 h-10 text-green-600" /> : 
                 orderStatus === "timeout" ? <AlertCircle className="w-10 h-10 text-red-600" /> :
                 <Smartphone className="w-10 h-10 text-[#2b6eff]" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-black">
                  {orderStatus === "paid" ? "Sucesso!" : 
                   orderStatus === "checking" ? "A verificar..." :
                   orderStatus === "timeout" ? "Tempo esgotado" : 
                   "Autorize no Celular"}
                </h3>
                <p className="text-gray-500 text-sm">
                  {orderStatus === "paid" ? "Pagamento confirmado. Redirecionando..." : 
                   orderStatus === "checking" ? "A consultar o estado do pagamento..." :
                   orderStatus === "timeout" ? "Inseriu o PIN depois do tempo? Clique em verificar." : 
                   "Introduza o PIN e confirme para finalizar a compra de " + formattedPrice}
                </p>
              </div>
              {orderStatus === "pending" && (
                <div className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 rounded-xl">
                  <Timer size={18} className="text-gray-400" />
                  <span className="font-bold text-xl text-black tabular-nums">{Math.floor(modalCountdown / 60)}:{(modalCountdown % 60).toString().padStart(2, '0')}</span>
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
    </div>
  );
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [detectedLang] = useState<CheckoutLang>("pt");
  const [detectedCountry] = useState("MZ");

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
      <CheckoutForm checkout={checkout} lang={detectedLang} t={getTranslations(detectedLang)} detectedCountry={detectedCountry} />
    </Elements>
  );
}
