import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function SuccessPage() {
  const { checkoutId } = useParams<{ checkoutId: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [state, setState] = useState<"loading" | "offer-inline" | "done" | "error">("loading");
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [offerToken, setOfferToken] = useState<string | null>(null);

  useEffect(() => {
    if (!checkoutId || !sessionId) { setState("error"); return; }
    let attempts = 0;
    const maxAttempts = 30;
    const poll = async () => {
      attempts++;
      const { data: order } = await supabase.from("orders").select("id, checkout_id").eq("checkout_id", checkoutId).eq("status", "paid").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!order) {
        if (attempts >= maxAttempts) {
          const { data: checkout } = await supabase.from("checkouts").select("redirect_url").eq("id", checkoutId).single();
          if (checkout?.redirect_url) window.location.href = checkout.redirect_url;
          else setState("done");
          return;
        }
        setTimeout(poll, 1000); return;
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
  }, [checkoutId, sessionId]);

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-[13px] text-muted-foreground">Confirmando seu pagamento...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-surface rounded-[10px] p-8 text-center max-w-sm w-full">
          <p className="text-[13px] text-muted-foreground">Erro ao carregar página. Verifique seu email para confirmação.</p>
        </div>
      </div>
    );
  }

  if (state === "offer-inline" && offerToken) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md mb-4 text-center">
          <p className="text-sm font-medium text-foreground">Pagamento confirmado!</p>
          <p className="text-[13px] text-muted-foreground mt-1">Temos uma oferta especial para você:</p>
        </div>
        <iframe src={`/offer-frame/${offerToken}`} className="w-full max-w-md border-0" style={{ minHeight: "480px" }} title="Oferta especial" />
        <Button variant="ghost" className="mt-4 text-[13px] text-muted-foreground hover:text-foreground" onClick={() => { setState("done"); if (redirectUrl) window.location.href = redirectUrl; }}>
          Pular ofertas →
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-surface rounded-[10px] p-8 text-center max-w-sm w-full space-y-4">
        <h2 className="text-lg font-bold text-foreground">Compra realizada!</h2>
        <p className="text-[13px] text-muted-foreground">Obrigado pela sua compra. Você receberá os detalhes por email.</p>
        {redirectUrl && <p className="text-[11px] text-muted-foreground">Redirecionando em alguns segundos...</p>}
      </div>
    </div>
  );
}
