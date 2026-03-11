import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCentsToBRL } from "@/lib/formatters";
import { Loader2 } from "lucide-react";

interface SessionData {
  id: string; token: string; offer_id: string; order_id: string; customer_id: string;
  decision: string | null; expires_at: string;
  offer: { id: string; name: string; product_id: string; page_url: string | null; products: { name: string; description: string | null; price: number } };
}

interface PreviewData { name: string; product: { name: string; description: string | null; price: number } }

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

  useEffect(() => {
    async function loadSession() {
      if (!token) return;
      if (isPreview) {
        const { data: offer, error: offerError } = await supabase.from("offers").select("id, name, product_id, products:product_id(name, description, price)").eq("id", token).maybeSingle();
        if (offerError || !offer) { setError("Oferta não encontrada para preview"); setLoading(false); return; }
        setPreview({ name: offer.name, product: offer.products as any }); setLoading(false); return;
      }
      const { data, error: fetchError } = await supabase.from("offer_sessions").select("id, token, offer_id, order_id, customer_id, decision, expires_at, offers:offer_id(id, name, product_id, page_url, products:product_id(name, description, price))").eq("token", token).maybeSingle();
      if (fetchError || !data) { setError("Sessão de oferta não encontrada"); setLoading(false); return; }
      if (new Date(data.expires_at) < new Date()) { setError("Esta oferta expirou"); setLoading(false); return; }
      if (data.decision) { setResult({ decision: data.decision }); setLoading(false); return; }
      setSession({ ...data, offer: data.offers as any } as any); setLoading(false);
    }
    loadSession();
  }, [token, isPreview]);

  const handleDecision = async (decision: "accepted" | "rejected") => {
    if (!session || !token) return;
    setProcessing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("offer-decision", { body: { token, decision } });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      const nextToken = data?.next_offer_token || null;
      const nextPageUrl = data?.next_offer_page_url || null;
      setResult({ decision, redirecting: !!nextToken });
      if (window.parent !== window) { window.parent.postMessage({ type: "offer-complete", decision, nextToken, nextPageUrl }, "*"); }
      if (window.parent === window) {
        if (nextPageUrl && nextToken) { window.location.href = `${nextPageUrl}${nextPageUrl.includes("?") ? "&" : "?"}offer_token=${nextToken}`; }
        else if (data?.next_offer_url) { window.location.href = data.next_offer_url; }
      }
    } catch (err: any) { setError(err.message || "Erro ao processar decisão"); }
    finally { setProcessing(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px] bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-background px-4">
        <div className="card-surface rounded-[10px] p-8 text-center max-w-sm w-full">
          <p className="text-[13px] text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (isPreview && preview) {
    return (
      <div className="flex items-center justify-center min-h-[480px] max-h-[480px] bg-background px-4 py-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide pill-pending">PREVIEW</div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{preview.product.name}</h2>
            {preview.product.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{preview.product.description}</p>}
          </div>
          <div className="border-t border-border my-6" />
          <div className="text-[32px] font-bold text-foreground tabular-nums">{formatCentsToBRL(preview.product.price)}</div>
          <p className="text-[11px] text-muted-foreground">Cobrança automática no mesmo cartão</p>
          <div className="space-y-3 pt-2">
            <button className="w-full h-12 bg-primary text-primary-foreground font-bold text-sm rounded-lg opacity-50 cursor-not-allowed">Sim, quero!</button>
            <button className="w-full text-sm text-muted-foreground hover:text-foreground opacity-50 cursor-not-allowed">Não, obrigado</button>
          </div>
          <p className="text-[11px] text-[#f59e0b]">Modo preview — botões desativados.</p>
        </div>
      </div>
    );
  }

  if (result && !result.redirecting) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-background px-4">
        <div className="card-surface rounded-[10px] p-8 text-center max-w-sm w-full">
          <p className="text-sm font-medium text-foreground">{result.decision === "accepted" ? "Oferta aceita!" : "Oferta recusada"}</p>
          <p className="text-[13px] text-muted-foreground mt-1">{result.decision === "accepted" ? "Seu pagamento foi processado." : "Obrigado por considerar."}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const offer = session.offer;
  const product = offer.products;

  return (
    <div className="flex items-center justify-center min-h-[480px] max-h-[480px] bg-background px-4 py-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{product.name}</h2>
          {product.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{product.description}</p>}
        </div>
        <div className="border-t border-border" />
        <div className="text-[32px] font-bold text-foreground tabular-nums">{formatCentsToBRL(product.price)}</div>
        <p className="text-[11px] text-muted-foreground">Cobrança automática no mesmo cartão</p>
        <div className="space-y-3 pt-2">
          <button
            className="w-full h-12 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:brightness-110 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 flex items-center justify-center"
            onClick={() => handleDecision("accepted")}
            disabled={processing}
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, quero!"}
          </button>
          <button
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            onClick={() => handleDecision("rejected")}
            disabled={processing}
          >
            Não, obrigado
          </button>
        </div>
      </div>
    </div>
  );
}
