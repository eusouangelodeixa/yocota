import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCentsToBRL } from "@/lib/formatters";
import { ArrowDown, Check, X, Gift } from "lucide-react";

interface Offer {
  id: string;
  name: string;
  product_id: string;
  accept_next_offer_id: string | null;
  reject_next_offer_id: string | null;
  products?: { name: string; price: number } | null;
}

interface OfferFunnelTreeProps {
  offers: Offer[];
}

function OfferNode({
  offer,
  offers,
  depth = 0,
  visited = new Set<string>(),
}: {
  offer: Offer;
  offers: Offer[];
  depth?: number;
  visited?: Set<string>;
}) {
  if (visited.has(offer.id)) {
    return (
      <div className="ml-8 p-2 border border-dashed rounded border-muted-foreground/30 text-xs text-muted-foreground">
        ↻ {offer.name} (loop)
      </div>
    );
  }

  const nextVisited = new Set(visited);
  nextVisited.add(offer.id);

  const acceptOffer = offer.accept_next_offer_id
    ? offers.find((o) => o.id === offer.accept_next_offer_id)
    : null;
  const rejectOffer = offer.reject_next_offer_id
    ? offers.find((o) => o.id === offer.reject_next_offer_id)
    : null;

  return (
    <div className="flex flex-col items-center">
      <Card className="w-64 border-2 border-primary/20">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Gift className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{offer.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{offer.products?.name}</p>
          <Badge variant="secondary" className="mt-1">
            {formatCentsToBRL(offer.products?.price ?? 0)}
          </Badge>
        </CardContent>
      </Card>

      {(acceptOffer || rejectOffer) && (
        <div className="flex gap-12 mt-4">
          {/* Accept branch */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-xs font-medium text-green-600 mb-2">
              <Check className="h-3 w-3" />
              Aceitar
            </div>
            <ArrowDown className="h-4 w-4 text-green-600 mb-2" />
            {acceptOffer ? (
              <OfferNode offer={acceptOffer} offers={offers} depth={depth + 1} visited={nextVisited} />
            ) : (
              <div className="px-3 py-1 rounded bg-muted text-xs text-muted-foreground">
                Fim do funil
              </div>
            )}
          </div>

          {/* Reject branch */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-xs font-medium text-destructive mb-2">
              <X className="h-3 w-3" />
              Recusar
            </div>
            <ArrowDown className="h-4 w-4 text-destructive mb-2" />
            {rejectOffer ? (
              <OfferNode offer={rejectOffer} offers={offers} depth={depth + 1} visited={nextVisited} />
            ) : (
              <div className="px-3 py-1 rounded bg-muted text-xs text-muted-foreground">
                Fim do funil
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OfferFunnelTree({ offers }: OfferFunnelTreeProps) {
  // Find root offers (not referenced by any other offer)
  const referencedIds = new Set<string>();
  offers.forEach((o) => {
    if (o.accept_next_offer_id) referencedIds.add(o.accept_next_offer_id);
    if (o.reject_next_offer_id) referencedIds.add(o.reject_next_offer_id);
  });

  const roots = offers.filter((o) => !referencedIds.has(o.id));

  if (offers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Crie ofertas para visualizar o funil
        </CardContent>
      </Card>
    );
  }

  if (roots.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Todas as ofertas estão referenciadas em loops. Verifique a configuração.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 overflow-x-auto pb-4">
      {roots.map((root) => (
        <Card key={root.id}>
          <CardHeader>
            <CardTitle className="text-base">Funil: {root.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <OfferNode offer={root} offers={offers} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
