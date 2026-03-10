import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatCentsToBRL } from "@/lib/formatters";
import { Loader2, ShieldCheck, Lock, CreditCard, CheckCircle2, Sparkles } from "lucide-react";

interface CheckoutData {
  id: string;
  name: string;
  checkout_slug: string;
  redirect_url: string;
  product_id: string;
  order_bump_product_id: string | null;
  product: { id: string; name: string; description: string | null; price: number };
  bump_product?: { id: string; name: string; price: number } | null;
}

function CheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/20 flex items-center justify-center px-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}

function CheckoutNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/20 flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <span className="text-2xl">🔍</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
        <p className="text-muted-foreground text-sm">Este checkout não existe ou foi desativado.</p>
      </div>
    </div>
  );
}

function OrderBumpCard({
  bumpProduct,
  includeBump,
  onToggle,
}: {
  bumpProduct: { name: string; price: number };
  includeBump: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div
      className={`relative rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${
        includeBump
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-dashed border-border hover:border-primary/40"
      }`}
      onClick={() => onToggle(!includeBump)}
    >
      <div className="absolute -top-2.5 left-4">
        <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Oferta especial
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <Checkbox
          id="bump"
          checked={includeBump}
          onCheckedChange={(checked) => onToggle(checked === true)}
          className="mt-0.5"
        />
        <div className="flex-1">
          <label htmlFor="bump" className="font-semibold text-sm cursor-pointer text-foreground">
            Adicionar: {bumpProduct.name}
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aproveite o desconto exclusivo desta página
          </p>
        </div>
        <span className="text-sm font-bold text-primary whitespace-nowrap">
          +{formatCentsToBRL(bumpProduct.price)}
        </span>
      </div>
    </div>
  );
}

function TrustBadges() {
  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <div className="flex items-center justify-center gap-4 text-muted-foreground">
        <div className="flex items-center gap-1.5 text-xs">
          <Lock className="h-3.5 w-3.5" />
          <span>SSL Seguro</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Dados protegidos</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs">
          <CreditCard className="h-3.5 w-3.5" />
          <span>Stripe</span>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [includeBump, setIncludeBump] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [abandonedSaved, setAbandonedSaved] = useState(false);

  // Capture UTMs
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utms: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
      const val = params.get(key);
      if (val) utms[key] = val;
    });
    if (Object.keys(utms).length > 0) {
      sessionStorage.setItem("checkout_utms", JSON.stringify(utms));
    }
  }, []);

  // Load checkout data
  useEffect(() => {
    async function load() {
      if (!slug) return;
      const { data, error } = await supabase
        .from("checkouts")
        .select("*, products!checkouts_product_id_fkey(id, name, description, price)")
        .eq("checkout_slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const checkoutData: CheckoutData = {
        ...data,
        product: data.products as any,
      };

      if (data.order_bump_product_id) {
        const { data: bump } = await supabase
          .from("products")
          .select("id, name, price")
          .eq("id", data.order_bump_product_id)
          .eq("active", true)
          .single();
        checkoutData.bump_product = bump;
      }

      setCheckout(checkoutData);
      setLoading(false);
    }
    load();
  }, [slug]);

  // Save abandoned checkout when email is filled
  useEffect(() => {
    if (email && email.includes("@") && !abandonedSaved && checkout) {
      const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");
      supabase
        .from("abandoned_checkouts")
        .insert({
          checkout_id: checkout.id,
          name: customerName || null,
          email,
          phone: phone || null,
          utm_data: Object.keys(utms).length > 0 ? utms : null,
        })
        .then(() => setAbandonedSaved(true));
    }
  }, [email, abandonedSaved, checkout, customerName, phone]);

  const totalAmount = () => {
    if (!checkout) return 0;
    let total = checkout.product.price;
    if (includeBump && checkout.bump_product) {
      total += checkout.bump_product.price;
    }
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkout) return;

    if (!customerName.trim() || !email.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setProcessing(true);
    try {
      const utms = JSON.parse(sessionStorage.getItem("checkout_utms") || "{}");

      const { data: intentData, error: intentError } = await supabase.functions.invoke("create-intent", {
        body: {
          checkout_id: checkout.id,
          customer_name: customerName,
          customer_email: email,
          customer_phone: phone || null,
          include_bump: includeBump,
          utm_data: utms,
        },
      });

      if (intentError) throw new Error(intentError.message || "Erro ao criar pagamento");
      if (intentData?.error) throw new Error(intentData.error);

      if (intentData?.url) {
        window.location.href = intentData.url;
      } else {
        throw new Error("URL de pagamento não recebida");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar pagamento. Tente novamente.");
      setProcessing(false);
    }
  };

  if (loading) return <CheckoutSkeleton />;
  if (notFound) return <CheckoutNotFound />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/20 flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-[460px] space-y-6">
        {/* Product Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Oferta disponível
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {checkout?.product.name}
          </h1>
          {checkout?.product.description && (
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {checkout.product.description}
            </p>
          )}
        </div>

        {/* Main Card */}
        <div className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/60 overflow-hidden">
          {/* Price Banner */}
          <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-5 text-center">
            <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider mb-1">
              Investimento
            </p>
            <div className="text-3xl sm:text-4xl font-extrabold text-primary-foreground tracking-tight">
              {formatCentsToBRL(checkout?.product.price ?? 0)}
            </div>
          </div>

          {/* Form */}
          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Nome completo
                  </Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    required
                    className="h-11 rounded-lg bg-muted/40 border-border/60 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="h-11 rounded-lg bg-muted/40 border-border/60 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    WhatsApp <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="h-11 rounded-lg bg-muted/40 border-border/60 focus:bg-background transition-colors"
                  />
                </div>
              </div>

              {/* Order Bump */}
              {checkout?.bump_product && (
                <OrderBumpCard
                  bumpProduct={checkout.bump_product}
                  includeBump={includeBump}
                  onToggle={setIncludeBump}
                />
              )}

              {/* Total */}
              <div className="bg-muted/40 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Total a pagar</span>
                  <span className="text-2xl font-extrabold text-foreground">
                    {formatCentsToBRL(totalAmount())}
                  </span>
                </div>
              </div>

              {/* CTA Button */}
              <Button
                type="submit"
                className="w-full h-14 text-base font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Finalizar compra
                  </>
                )}
              </Button>

              {/* Trust Badges */}
              <TrustBadges />
            </form>
          </div>
        </div>

        {/* Footer guarantee */}
        <p className="text-center text-xs text-muted-foreground/70 leading-relaxed">
          Ao clicar em "Finalizar compra", você será redirecionado para um ambiente seguro de pagamento processado pela Stripe.
        </p>
      </div>
    </div>
  );
}
