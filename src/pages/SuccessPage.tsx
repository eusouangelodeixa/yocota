import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";

function useDocTitle(title: string) {
  useEffect(() => { document.title = title; return () => { document.title = "Yocota"; }; }, [title]);
}

export default function SuccessPage() {
  const { checkoutId } = useParams<{ checkoutId: string }>();
  const [searchParams] = useSearchParams();
  const paymentIntentId = searchParams.get("payment_intent_id");
  const debitoReference = searchParams.get("debito_reference");
  const urlOrderId = searchParams.get("order_id");

  const [state, setState] = useState<"loading" | "offer-inline" | "done" | "error">("loading");
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [offerToken, setOfferToken] = useState<string | null>(null);

  useDocTitle("Pagamento confirmado");

  useEffect(() => {
    if (!checkoutId || (!paymentIntentId && !debitoReference && !urlOrderId)) { setState("error"); return; }

    const formatAbsoluteUrl = (url: string) => url.startsWith("http") ? url : `https://${url}`;

    // Fetch checkout config once upfront (parallel with first poll)
    let checkoutData: { redirect_url: string; first_offer_id: string | null } | null = null;
    const fetchCheckout = supabase.from("checkouts").select("redirect_url, first_offer_id").eq("id", checkoutId).single()
      .then(({ data }) => { 
        checkoutData = data; 
        if (data?.redirect_url) setRedirectUrl(formatAbsoluteUrl(data.redirect_url)); 
      });

    let attempts = 0;
    const maxAttempts = 20;
    const poll = async () => {
      attempts++;
      await fetchCheckout; // ensure checkout is loaded (resolves instantly after first call)

      let orderId: string | null = urlOrderId || null;
      
      // Fallback: Se não trouxe order_id na URL (ex: Stripe redirecionou direto sem ele), tenta buscar pelo intent
      if (!orderId && paymentIntentId) {
        const { data: order } = await supabase.from("orders").select("id").eq("stripe_payment_intent_id", paymentIntentId).eq("status", "paid").maybeSingle();
        orderId = order?.id || null;
      }

      if (!orderId) {
        if (attempts >= maxAttempts) {
          if (checkoutData?.redirect_url) window.location.href = formatAbsoluteUrl(checkoutData.redirect_url);
          else setState("done");
          return;
        }
        setTimeout(poll, 1000); // Polling ameno (1s) apenas se não houver order_id imediato
        return;
      }

      // Order found — check if there's an offer funnel
      const hasOfferFunnel = !!checkoutData?.first_offer_id;
      if (!hasOfferFunnel) {
        setState("done");
        if (checkoutData?.redirect_url) setTimeout(() => { window.location.href = checkoutData!.redirect_url; }, 3000);
        return;
      }

      // Offer session is created right after the order in the webhook,
      // so it should be available almost immediately. Quick retry loop.
      for (let i = 0; i < 15; i++) {
        const { data: offerSession } = await supabase
          .from("offer_sessions")
          .select("token, offer_id")
          .eq("order_id", orderId)
          .is("decision", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (offerSession?.token) {
          const { data: offer } = await supabase.from("offers").select("page_url").eq("id", offerSession.offer_id).single();
          if (offer?.page_url) {
            window.location.href = `${offer.page_url}${offer.page_url.includes("?") ? "&" : "?"}offer_token=${offerSession.token}`;
          } else {
            setOfferToken(offerSession.token);
            setState("offer-inline");
          }
          return;
        }
        // Short wait — offer_session is inserted milliseconds after order
        await new Promise(r => setTimeout(r, 300));
      }

      // Give up waiting for offer session
      setState("done");
      if (checkoutData?.redirect_url) setTimeout(() => { window.location.href = checkoutData!.redirect_url; }, 3000);
    };
    poll();
  }, [checkoutId, paymentIntentId, debitoReference]);

  const handleIframeMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === "offer-complete") {
      const { nextToken, nextPageUrl } = event.data;
      if (nextPageUrl && nextToken) { window.location.href = `${nextPageUrl}${nextPageUrl.includes("?") ? "&" : "?"}offer_token=${nextToken}`; }
      else if (nextToken) { setOfferToken(nextToken); }
      else { setState("done"); if (redirectUrl) setTimeout(() => { window.location.href = redirectUrl; }, 3000); }
    }
  }, [redirectUrl]);

  useEffect(() => { window.addEventListener("message", handleIframeMessage); return () => window.removeEventListener("message", handleIframeMessage); }, [handleIframeMessage]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#28d56a] mx-auto" />
          <p className="text-[13px] text-[#a1a1aa]">
            {debitoReference ? "Aguardando confirmação do PIN no seu celular..." : "Confirmando seu pagamento..."}
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
        <div className="bg-[#18181b] border border-[#27272a] rounded-[10px] p-8 text-center max-w-sm w-full">
          <p className="text-[13px] text-[#a1a1aa]">Erro ao carregar página. Verifique seu email para confirmação.</p>
        </div>
      </div>
    );
  }

  if (state === "offer-inline" && offerToken) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md mb-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-[#28d56a] mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-medium text-[#fafafa]">Pagamento confirmado!</p>
          <p className="text-[13px] text-[#a1a1aa] mt-1">Temos uma oferta especial para você:</p>
        </div>
        <iframe src={`/offer-frame/${offerToken}`} className="w-full max-w-md border-0 rounded-[10px]" style={{ minHeight: "480px" }} title="Oferta especial" />
        <button
          className="mt-4 text-[13px] text-[#52525b] hover:text-[#a1a1aa] transition-colors duration-150"
          onClick={() => { setState("done"); if (redirectUrl) window.location.href = redirectUrl; }}
        >
          Pular ofertas →
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-[10px] p-8 text-center max-w-sm w-full space-y-4">
        <CheckCircle2 className="h-10 w-10 text-[#28d56a] mx-auto" strokeWidth={1.5} />
        <h2 className="text-lg font-bold text-[#fafafa]">Compra realizada!</h2>
        <p className="text-[13px] text-[#a1a1aa]">Obrigado pela sua compra. Você receberá os detalhes por email ou WhatsApp.</p>
        {redirectUrl && <p className="text-[11px] text-[#52525b]">Redirecionando em alguns segundos...</p>}
      </div>
    </div>
  );
}
