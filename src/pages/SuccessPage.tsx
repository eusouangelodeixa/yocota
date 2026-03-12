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

  const [state, setState] = useState<"loading" | "offer-inline" | "done" | "error">("loading");
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [offerToken, setOfferToken] = useState<string | null>(null);

  useDocTitle("Pagamento confirmado");

  useEffect(() => {
    if (!checkoutId || !paymentIntentId) { setState("error"); return; }
    let attempts = 0;
    const maxAttempts = 60;
    const poll = async () => {
      attempts++;
      // Try to find the order by payment_intent_id first, fallback to checkout_id
      const { data: order } = await supabase
        .from("orders")
        .select("id, checkout_id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .eq("status", "paid")
        .maybeSingle();

      if (!order) {
        if (attempts >= maxAttempts) {
          const { data: checkout } = await supabase.from("checkouts").select("redirect_url").eq("id", checkoutId).single();
          if (checkout?.redirect_url) window.location.href = checkout.redirect_url;
          else setState("done");
          return;
        }
        setTimeout(poll, 500); return;
      }
      const { data: checkout } = await supabase.from("checkouts").select("redirect_url").eq("id", checkoutId).single();
      setRedirectUrl(checkout?.redirect_url || "");
      const { data: offerSession } = await supabase.from("offer_sessions").select("token, decision, offer_id").eq("order_id", order.id).is("decision", null).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!offerSession?.token) { setState("done"); if (checkout?.redirect_url) setTimeout(() => { window.location.href = checkout.redirect_url; }, 3000); return; }
      const { data: offer } = await supabase.from("offers").select("page_url").eq("id", offerSession.offer_id).single();
      if (offer?.page_url) { window.location.href = `${offer.page_url}${offer.page_url.includes("?") ? "&" : "?"}offer_token=${offerSession.token}`; }
      else { setOfferToken(offerSession.token); setState("offer-inline"); }
    };
    poll();
  }, [checkoutId, paymentIntentId]);

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
          <p className="text-[13px] text-[#a1a1aa]">Confirmando seu pagamento...</p>
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
