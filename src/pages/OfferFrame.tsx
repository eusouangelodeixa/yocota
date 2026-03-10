import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCentsToBRL } from "@/lib/formatters";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface SessionData {
  id: string;
  token: string;
  offer_id: string;
  order_id: string;
  customer_id: string;
  decision: string | null;
  expires_at: string;
  offer: {
    id: string;
    name: string;
    product_id: string;
    products: { name: string; description: string | null; price: number };
  };
}

export default function OfferFrame() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ decision: string; nextUrl?: string } | null>(null);

  useEffect(() => {
    async function loadSession() {
      if (!token) return;

      const { data, error: fetchError } = await supabase
        .from("offer_sessions")
        .select("*, offers(id, name, product_id, products(name, description, price))")
        .eq("token", token)
        .maybeSingle();

      if (fetchError || !data) {
        setError("Sessão de oferta não encontrada");
        setLoading(false);
        return;
      }

      // Check expiry
      if (new Date(data.expires_at) < new Date()) {
        setError("Esta oferta expirou");
        setLoading(false);
        return;
      }

      // Already decided
      if (data.decision) {
        setResult({ decision: data.decision });
        setLoading(false);
        return;
      }

      setSession({
        ...data,
        offer: data.offers as any,
      } as any);
      setLoading(false);
    }
    loadSession();
  }, [token]);

  const handleDecision = async (decision: "accepted" | "rejected") => {
    if (!session || !token) return;
    setProcessing(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("offer-decision", {
        body: { token, decision },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResult({
        decision,
        nextUrl: data?.next_offer_url || undefined,
      });

      // If there's a next offer, redirect the iframe
      if (data?.next_offer_url) {
        window.location.href = data.next_offer_url;
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar decisão");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result && !result.nextUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="py-8 text-center">
            {result.decision === "accepted" ? (
              <>
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-foreground">Oferta aceita!</p>
                <p className="text-sm text-muted-foreground mt-1">Seu pagamento foi processado.</p>
              </>
            ) : (
              <>
                <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-foreground">Oferta recusada</p>
                <p className="text-sm text-muted-foreground mt-1">Obrigado por considerar.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) return null;

  const offer = session.offer;
  const product = offer.products;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <Card className="w-full max-w-sm border-2 border-primary/20">
        <CardContent className="py-6 text-center space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">{offer.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{product.name}</p>
            {product.description && (
              <p className="text-xs text-muted-foreground mt-1">{product.description}</p>
            )}
          </div>

          <div className="text-3xl font-bold text-primary">
            {formatCentsToBRL(product.price)}
          </div>

          <p className="text-xs text-muted-foreground">
            Cobrança automática no mesmo cartão da compra anterior
          </p>

          <div className="space-y-2 pt-2">
            <Button
              className="w-full h-12 text-base"
              onClick={() => handleDecision("accepted")}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Sim, quero!
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => handleDecision("rejected")}
              disabled={processing}
            >
              Não, obrigado
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
