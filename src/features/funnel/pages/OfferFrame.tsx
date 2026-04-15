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
  const [modalCountdown, setModalCountdown] = useState(300);
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
      if (decision === "accepted") {
        // Show modal IMMEDIATELY — before the API call, so user sees it when M-Pesa popup arrives
        setShowPaymentModal(true);
        setOrderStatus("pending");
        setModalCountdown(300);
      }

      const { data, error: fnError } = await supabase.functions.invoke("offer-decision", { body: { token, decision } });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      if (data?.payment_method === "debito") {
        if (data?.payment_confirmed === true) {
          // M-Pesa SYNCHRONOUS: payment already confirmed — skip polling
          setOrderStatus("paid");
          setTimeout(() => finalizeDecision(data), 1500);
          return;
        }

        // e-Mola ASYNC: poll offer_sessions table directly for decision update
        const sessionToken = data?.offer_session_token || token;
        const decisionData = data;
        let cancelled = false;

        const pollOfferSession = async () => {
          // Continue polling even after timeout — stop only when paid or explicitly cancelled
          if (cancelled || orderStatusRef.current === "paid") return;
          try {
            const { data: sess } = await supabase
              .from("offer_sessions")
              .select("decision")
              .eq("token", sessionToken)
              .maybeSingle();
            if (cancelled || orderStatusRef.current === "paid") return;
            if (sess?.decision === "accepted") {
              setOrderStatus("paid");
              setTimeout(() => finalizeDecision(decisionData), 1500);
            } else {
              setTimeout(pollOfferSession, 3000);
            }
          } catch (e) {
            if (!cancelled && orderStatusRef.current !== "paid") setTimeout(pollOfferSession, 3000);
          }
        };
        pollOfferSession();
        return;
      }

      finalizeDecision(data);
    } catch (err: any) {
      setShowPaymentModal(false);
      setError(err.message || "Erro ao processar decisão");
      setProcessing(false);
    }
  };

  const finalizeDecision = (data: any) => {
    const decision = data.decision;
    const nextToken = data?.next_offer_token || null;
    const nextPageUrl = data?.next_offer_page_url || null;
    const nextOfferUrl = data?.next_offer_url || null;
    setResult({ decision, redirecting: !!nextToken });

    if (window.parent === window) {
      // Standalone mode (not in any iframe) — navigate directly
      if (nextPageUrl && nextToken) {
        const sep = nextPageUrl.includes("?") ? "&" : "?";
        window.location.href = `${nextPageUrl}${sep}offer_token=${nextToken}`;
      } else if (nextOfferUrl) {
        window.location.href = nextOfferUrl;
      }
    } else {
      // In an iframe — ALWAYS send postMessage (backward compat with existing embeds)
      window.parent.postMessage({ type: "offer-complete", decision, nextToken, nextPageUrl }, "*");

      // Also navigate window.top as backup (for sites without a JS postMessage listener)
      // Only when there is a URL to navigate to; with 600ms delay so postMessage fires first
      let isCrossOrigin = false;
      try { void window.parent.document; } catch { isCrossOrigin = true; }
      if (isCrossOrigin && (nextPageUrl || nextOfferUrl)) {
        setTimeout(() => {
          const target = window.top!;
          if (nextPageUrl && nextToken) {
            const sep = nextPageUrl.includes("?") ? "&" : "?";
            target.location.href = `${nextPageUrl}${sep}offer_token=${nextToken}`;
          } else if (nextOfferUrl) {
            target.location.href = nextOfferUrl;
          }
        }, 600);
      }
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
      className="flex items-center justify-center min-h-screen px-4 py-6"
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
            className="w-full font-semibold text-sm transition-all duration-150 flex items-center justify-center"
            style={{
              height: `${Number(s.button_height) || 48}px`,
              backgroundColor: s.accept_button_color || "#22c55e",
              color: s.accept_button_text_color || "#ffffff",
              borderRadius: `${Math.min(Number(s.border_radius) || 8, 12)}px`,
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
              backgroundColor: s.reject_button_color || "transparent",
              color: s.reject_text_color || "#6b7280",
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
                   orderStatus === "timeout" ? "Se já confirmou o PIN no telemóvel, o pagamento está a ser verificado. Aguarde uns instantes..." : 
                   "Introduza o PIN e confirme para finalizar a compra de " + formatCents(product?.price ?? 0, product?.currency ?? "mzn")}
                </p>
              </div>
              {orderStatus === "pending" && (
                <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 rounded-xl">
                  <Timer size={16} className="text-gray-400" />
                  <span className="font-bold text-lg text-black tabular-nums">{Math.floor(modalCountdown / 60)}:{(modalCountdown % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
              {orderStatus === "timeout" && (
                <div className="w-full space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-amber-50 rounded-xl">
                    <Loader2 size={14} className="text-amber-500 animate-spin" />
                    <span className="text-amber-600 text-xs font-medium">A verificar pagamento...</span>
                  </div>
                  <button onClick={() => { setShowPaymentModal(false); setProcessing(false); }} className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-500 font-medium text-sm">Fechar (o produto será entregue se o pagamento foi confirmado)</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
