import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { formatCentsToBRL } from "@/lib/formatters";

interface Offer {
  id: string; name: string; product_id: string;
  accept_next_offer_id: string | null; reject_next_offer_id: string | null;
  products?: { name: string; price: number } | null;
}

interface OfferFunnelTreeProps { offers: Offer[]; }

function OfferNode({ offer, offers, depth = 0, visited = new Set<string>() }: { offer: Offer; offers: Offer[]; depth?: number; visited?: Set<string> }) {
  if (visited.has(offer.id)) {
    return <div className="ml-8 p-2 border border-dashed rounded border-border text-[11px] text-muted-foreground">↻ {offer.name} (loop)</div>;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(offer.id);
  const acceptOffer = offer.accept_next_offer_id ? offers.find((o) => o.id === offer.accept_next_offer_id) : null;
  const rejectOffer = offer.reject_next_offer_id ? offers.find((o) => o.id === offer.reject_next_offer_id) : null;

  return (
    <div className="flex flex-col items-center">
      <div className="card-surface rounded-[10px] w-56 p-4 text-center">
        <span className="text-[13px] font-medium text-foreground">{offer.name}</span>
        <p className="text-[11px] text-muted-foreground mt-0.5">{offer.products?.name}</p>
        <Badge variant="secondary" className="mt-1.5 text-[10px]">{formatCentsToBRL(offer.products?.price ?? 0)}</Badge>
      </div>
      {(acceptOffer || rejectOffer) && (
        <div className="flex gap-12 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-medium text-primary mb-2">✓ Aceitar</span>
            <div className="w-px h-4 bg-primary mb-2" />
            {acceptOffer ? <OfferNode offer={acceptOffer} offers={offers} depth={depth + 1} visited={nextVisited} /> : <div className="px-3 py-1 rounded bg-secondary text-[11px] text-muted-foreground">Fim</div>}
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-medium text-destructive mb-2">✕ Recusar</span>
            <div className="w-px h-4 bg-destructive mb-2" />
            {rejectOffer ? <OfferNode offer={rejectOffer} offers={offers} depth={depth + 1} visited={nextVisited} /> : <div className="px-3 py-1 rounded bg-secondary text-[11px] text-muted-foreground">Fim</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export const OfferFunnelTree = React.forwardRef<HTMLDivElement, OfferFunnelTreeProps>(({ offers }, ref) => {
  const referencedIds = new Set<string>();
  offers.forEach((o) => { if (o.accept_next_offer_id) referencedIds.add(o.accept_next_offer_id); if (o.reject_next_offer_id) referencedIds.add(o.reject_next_offer_id); });
  const roots = offers.filter((o) => !referencedIds.has(o.id));

  if (offers.length === 0) return <div ref={ref} className="card-surface rounded-[10px] py-12 text-center text-muted-foreground text-[13px]">Crie ofertas para visualizar o funil</div>;
  if (roots.length === 0) return <div ref={ref} className="card-surface rounded-[10px] py-12 text-center text-muted-foreground text-[13px]">Todas as ofertas estão em loops.</div>;

  return (
    <div ref={ref} className="space-y-8 overflow-x-auto pb-4">
      {roots.map((root) => (
        <div key={root.id} className="card-surface rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-medium text-foreground">Funil: {root.name}</h3></div>
          <div className="flex justify-center py-6"><OfferNode offer={root} offers={offers} /></div>
        </div>
      ))}
    </div>
  );
});
OfferFunnelTree.displayName = "OfferFunnelTree";
