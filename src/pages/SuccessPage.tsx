import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, PartyPopper } from "lucide-react";

export default function SuccessPage() {
  const { checkoutId } = useParams<{ checkoutId: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [state, setState] = useState<"loading" | "offer-inline" | "done" | "error">("loading");
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [offerToken, setOfferToken] = useState<string | null>(null);

  useEffect(() => {
    if (!checkoutId || !sessionId) {
      setState("error");
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      attempts++;

      // Find the paid order for this checkout
      const { data: order } = await supabase
        .from("orders")
        .select("id, checkout_id")
        .eq("checkout_id", checkoutId)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!order) {
        if (attempts >= maxAttempts) {
          const { data: checkout } = await supabase
            .from("checkouts")
            .select("redirect_url")
            .eq("id", checkoutId)
            .single();
          if (checkout?.redirect_url) {
            window.location.href = checkout.redirect_url;
          } else {
            setState("done");
          }
          return;
        }
        setTimeout(poll, 1000);
        return;
      }

      // Get checkout redirect_url
      const { data: checkout } = await supabase
        .from("checkouts")
        .select("redirect_url")
        .eq("id", checkoutId)
        .single();

      setRedirectUrl(checkout?.redirect_url || "");

      // Check for pending offer session
      const { data: offerSession } = await supabase
        .from("offer_sessions")
        .select("token, decision, offer_id")
        .eq("order_id", order.id)
        .is("decision", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!offerSession?.token) {
        // No offers — go to final redirect
        setState("done");
        if (checkout?.redirect_url) {
          setTimeout(() => { window.location.href = checkout.redirect_url; }, 3000);
        }
        return;
      }

      // Check if the offer has an external page_url
      const { data: offer } = await supabase
        .from("offers")
        .select("page_url")
        .eq("id", offerSession.offer_id)
        .single();

      if (offer?.page_url) {
        // EXTERNAL MODE: redirect to the offer's external page with token
        window.location.href = `${offer.page_url}${offer.page_url.includes("?") ? "&" : "?"}offer_token=${offerSession.token}`;
      } else {
        // INLINE MODE: show iframe in our success page
        setOfferToken(offerSession.token);
        setState("offer-inline");
      }
    };

    poll();
  }, [checkoutId, sessionId]);

  // Listen for messages from offer iframe (inline mode)
  const handleIframeMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === "offer-complete") {
      const { nextToken, nextPageUrl } = event.data;
      if (nextPageUrl && nextToken) {
        // Next offer has external page — redirect there
        window.location.href = `${nextPageUrl}${nextPageUrl.includes("?") ? "&" : "?"}offer_token=${nextToken}`;
      } else if (nextToken) {
        // Next offer is inline — update iframe
        setOfferToken(nextToken);
      } else {
        // No more offers — done
        setState("done");
        if (redirectUrl) {
          setTimeout(() => { window.location.href = redirectUrl; }, 3000);
        }
      }
    }
  }, [redirectUrl]);

  useEffect(() => {
    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, [handleIframeMessage]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Confirmando seu pagamento...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Erro ao carregar página. Verifique seu email para confirmação.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "offer-inline" && offerToken) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md mb-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            <p className="font-semibold text-foreground">Pagamento confirmado!</p>
          </div>
          <p className="text-sm text-muted-foreground">Temos uma oferta especial para você:</p>
        </div>
        <iframe
          src={`/offer-frame/${offerToken}`}
          className="w-full max-w-md border-0 rounded-lg shadow-lg"
          style={{ minHeight: "450px" }}
          title="Oferta especial"
        />
        <Button
          variant="ghost"
          className="mt-4 text-sm text-muted-foreground"
          onClick={() => {
            setState("done");
            if (redirectUrl) window.location.href = redirectUrl;
          }}
        >
          Pular ofertas →
        </Button>
      </div>
    );
  }

  // Done state
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="py-8 text-center space-y-4">
          <PartyPopper className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Compra realizada!</h2>
          <p className="text-sm text-muted-foreground">
            Obrigado pela sua compra. Você receberá os detalhes por email.
          </p>
          {redirectUrl && (
            <p className="text-xs text-muted-foreground">Redirecionando em alguns segundos...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
