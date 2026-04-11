import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "@/lib/formatters";
import { Loader2, CheckCircle2, Smartphone, AlertCircle, Timer, Lock } from "lucide-react";
import { defaultPopupStyle, type PopupStyle } from "@/components/OfferPopupEditor";

interface SessionData {
  id: string; token: string; offer_id: string; order_id: string; customer_id: string;
  decision: string | null; expires_at: string;
  offer: { id: string; name: string; product_id: string; page_url: string | null; popup_style: any; products: { id: string; name: string; description: string | null; price: number; currency: string } };
}

interface PreviewData { name: string; popup_style: any; product: { name: string; description: string | null; price: number; currency: string } }

function getStyle(raw: any): PopupStyle {
  return { ...defaultPopupStyle, ...(raw || {}) };
}

export default function OfferFrame() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";

  const [session, setSession] = useState<SessionData | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ decision: string; redirecting?: boolean } | null>(null);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalCountdown, setModalCountdown] = useState(120);
  const [orderStatus, setOrderStatus] = useState<"pending" | "paid" | "failed" | "timeout">("pending");

  // Ref to track latest orderStatus inside polling closures
  const orderStatusRef = useRef(orderStatus);
  useEffect(() => { orderStatusRef.current = orderStatus; }, [orderStatus]);

  useEffect(() => {
    async function loadSession() {
      if (!token) return;
      if (isPreview) {
        const { data: offer, error: offerError } = await supabase.from("offers").select("id, name, product_id, popup_style, products:product_id(name, description, price, currency)").eq("id", token).maybeSingle();
        if (offerError || !offer) { setError("Oferta não encontrada para preview"); setLoading(false); return; }
        setPreview({ name: offer.name, popup_style: offer.popup_style, product: offer.products as any }); setLoading(false); return;
      }
      const { data, error: fetchError } = await supabase.from("offer_sessions").select("id, token, offer_id, order_id, customer_id, decision, expires_at, offers:offer_id(id, name, product_id, page_url, popup_style, products:product_id(name, description, price, currency))").eq("token", token).maybeSingle();
      if (fetchError || !data) { setError("Sessão de oferta não encontrada"); setLoading(false); return; }
      if (new Date(data.expires_at) < new Date()) { setError("Esta oferta expirou"); setLoading(false); return; }
      if (data.decision) { setResult({ decision: data.decision }); setLoading(false); return; }
      setSession({ ...data, offer: data.offers as any } as any); setLoading(false);
    }
    loadSession();
  }, [token, isPreview]);

  // Modal countdown timer — runs independently
  useEffect(() => {
    let timer: any;
    if (showPaymentModal && orderStatus === "pending") {
      timer = setInterval(() => {
        setModalCountdown((prev) => {
          if (prev <= 1) { clearInterval(timer); setOrderStatus("timeout"); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [showPaymentModal, orderStatus]);

  const handleDecision = async (decision: "accepted" | "rejected") => {
    if (!session || !token) return;
    setProcessing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("offer-decision", { body: { token, decision } });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      if (data?.payment_method === "debito" && data?.debito_reference) {
        // Show modal and start polling
        setShowPaymentModal(true);
        setOrderStatus("pending");
        setModalCountdown(120);

        const debitoRef = data.debito_reference;
        const decisionData = data;
        let cancelled = false;

        const pollDebito = async () => {
          if (cancelled || orderStatusRef.current !== "pending") return;
          try {
            const { data: statusData } = await supabase.functions.invoke("process-debito-payment", {
              body: { action: "status", debito_reference: debitoRef }
            });
            if (cancelled || orderStatusRef.current !== "pending") return;
            if (statusData?.status === "SUCCESS" || statusData?.status === "PAID") {
              setOrderStatus("paid");
              setTimeout(() => finalizeDecision(decisionData), 1500);
            } else {
              // Continue polling after 3 seconds
              setTimeout(pollDebito, 3000);
            }
          } catch (e) {
            console.warn("Polling error:", e);
            if (!cancelled && orderStatusRef.current === "pending") {
              setTimeout(pollDebito, 3000);
            }
          }
        };
        pollDebito();
        return;
      }

      finalizeDecision(data);
    } catch (err: any) { setError(err.message || "Erro ao processar decisão"); setProcessing(false); }
  };

  const finalizeDecision = (data: any) => {
    const decision = data.decision;
    const nextToken = data?.next_offer_token || null;
    const nextPageUrl = data?.next_offer_page_url || null;
    setResult({ decision, redirecting: !!nextToken });
    if (window.parent !== window) { window.parent.postMessage({ type: "offer-complete", decision, nextToken, nextPageUrl }, "*"); }
    if (window.parent === window) {
      if (nextPageUrl && nextToken) { window.location.href = `${nextPageUrl}${nextPageUrl.includes("?") ? "&" : "?"}offer_token=${nextToken}`; }
      else if (data?.next_offer_url) { window.location.href = data.next_offer_url; }
    }
    setProcessing(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}><Loader2 className="h-6 w-6 animate-spin text-white" /></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className="rounded-[10px] p-8 text-center max-w-sm w-full bg-white">
          <p className="text-[13px] text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (result && !result.redirecting) {
    const s = getStyle(session?.offer?.popup_style);
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4" style={{ backgroundColor: s.overlay_bg_color }}>
        <div className="rounded-[10px] p-8 text-center max-w-sm w-full" style={{ backgroundColor: s.popup_bg_color, borderRadius: `${s.border_radius}px`, border: s.border_color ? `1px solid ${s.border_color}` : "none" }}>
          <p className="text-sm font-medium" style={{ color: s.title_color }}>{result.decision === "accepted" ? "Oferta aceita!" : "Oferta recusada"}</p>
          <p className="text-[13px] mt-1" style={{ color: s.description_color }}>{result.decision === "accepted" ? "Seu pagamento foi processado." : "Obrigado por considerar."}</p>
        </div>
      </div>
    );
  }

  // Render popup (preview or live)
  const popupStyleRaw = isPreview ? preview?.popup_style : session?.offer?.popup_style;
  const s = getStyle(popupStyleRaw);
  const product = isPreview ? preview?.product : session?.offer?.products;
  const displayTitle = s.title || product?.name || "";
  const displayDescription = s.description || product?.description || "";
  const isPreviewMode = isPreview && preview;
  const disabledAttr = isPreviewMode ? true : processing;

  return (
    <div
      className="flex items-center justify-center min-h-[480px] max-h-[480px] px-4 py-6"
      style={{ backgroundColor: s.overlay_bg_color }}
    >
      <div
        className="w-full max-w-sm space-y-5"
        style={{
          backgroundColor: s.popup_bg_color,
          padding: `${s.padding}px`,
          borderRadius: `${s.border_radius}px`,
          border: s.border_color ? `1px solid ${s.border_color}` : "none",
          textAlign: s.text_align as any,
        }}
      >
        {isPreviewMode && (
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>PREVIEW</div>
        )}
        {s.subtitle && (
          <p className="text-sm font-medium" style={{ color: s.subtitle_color }}>{s.subtitle}</p>
        )}
        <h2 className="text-lg font-semibold" style={{ color: s.title_color }}>{displayTitle}</h2>
        {displayDescription && <p className="text-sm leading-relaxed line-clamp-3" style={{ color: s.description_color }}>{displayDescription}</p>}
        <div style={{ borderTop: `1px solid ${s.border_color || '#e5e7eb'}` }} />
        <div className="text-[32px] font-bold tabular-nums" style={{ color: s.price_color }}>
          {formatCents(product?.price ?? 0, product?.currency ?? "brl")}
        </div>
        <p className="text-[11px]" style={{ color: s.charge_info_color }}>{s.charge_info_text}</p>
        <div className="space-y-3 pt-1">
          <button
            className="w-full font-bold text-sm transition-all duration-150 flex items-center justify-center"
            style={{
              height: `${s.button_height}px`,
              backgroundColor: s.accept_button_color,
              color: s.accept_button_text_color,
              borderRadius: `${Math.min(Number(s.border_radius), 12)}px`,
              border: "none",
              cursor: isPreviewMode ? "not-allowed" : "pointer",
              opacity: disabledAttr ? 0.7 : 1,
            }}
            onClick={isPreviewMode ? undefined : () => handleDecision("accepted")}
            disabled={disabledAttr}
          >
            {processing && !showPaymentModal ? <Loader2 className="h-4 w-4 animate-spin" /> : s.accept_button_text}
          </button>
          <button
            className="w-full text-sm transition-colors duration-150"
            style={{
              backgroundColor: s.reject_button_color,
              color: s.reject_text_color,
              border: "none",
              cursor: isPreviewMode ? "not-allowed" : "pointer",
              padding: "8px",
              opacity: isPreviewMode ? 0.7 : 1,
            }}
            onClick={isPreviewMode ? undefined : () => handleDecision("rejected")}
            disabled={disabledAttr}
          >
            {s.reject_button_text}
          </button>
        </div>
        {isPreviewMode && (
          <p className="text-[11px]" style={{ color: "#f59e0b" }}>Modo preview — botões desativados.</p>
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-[320px] rounded-[32px] p-6 shadow-3xl border animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-4 rounded-full ${orderStatus === "paid" ? "bg-green-100" : (orderStatus === "timeout" ? "bg-red-100" : "bg-blue-50")}`}>
                {orderStatus === "paid" ? <CheckCircle2 className="w-8 h-8 text-green-600" /> : 
                 orderStatus === "timeout" ? <AlertCircle className="w-8 h-8 text-red-600" /> :
                 <Smartphone className="w-8 h-8 text-[#2b6eff]" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-black">{orderStatus === "paid" ? "Sucesso!" : (orderStatus === "timeout" ? "Tempo Excedido" : "Autorize no Celular")}</h3>
                <p className="text-gray-500 text-[12px] leading-tight px-2">
                  {orderStatus === "paid" ? "Pagamento confirmado. Redirecionando..." : 
                   orderStatus === "timeout" ? "Não detectamos o pagamento. Tente novamente." : 
                   "Introduza o PIN e confirme para finalizar a compra de " + formatCents(product?.price ?? 0, product?.currency ?? "mzn")}
                </p>
              </div>
              {orderStatus === "pending" && (
                <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 rounded-xl">
                  <Timer size={16} className="text-gray-400" />
                  <span className="font-bold text-lg text-black tabular-nums">{Math.floor(modalCountdown / 60)}:{(modalCountdown % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
              {orderStatus !== "pending" && (
                <button onClick={() => { setShowPaymentModal(false); setProcessing(false); }} className="w-full py-3 rounded-xl bg-black text-white font-bold text-sm transition-transform active:scale-[0.98]">Fechar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
