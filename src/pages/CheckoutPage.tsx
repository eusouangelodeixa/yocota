import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatCentsToBRL } from "@/lib/formatters";
import { Loader2, ShieldCheck } from "lucide-react";

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

      // Load bump product if exists
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

      // 1. Create payment intent via edge function
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

      // 2. Redirect to Stripe Checkout
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
          <p className="text-muted-foreground">Checkout não encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{checkout?.product.name}</CardTitle>
          {checkout?.product.description && (
            <p className="text-sm text-muted-foreground mt-1">{checkout.product.description}</p>
          )}
          <div className="text-3xl font-bold text-primary mt-4">
            {formatCentsToBRL(checkout?.product.price ?? 0)}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (WhatsApp)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+5511999999999"
              />
            </div>

            {checkout?.bump_product && (
              <div className="border rounded-lg p-4 bg-accent/30">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="bump"
                    checked={includeBump}
                    onCheckedChange={(checked) => setIncludeBump(checked === true)}
                  />
                  <div>
                    <label htmlFor="bump" className="font-medium text-sm cursor-pointer">
                      Adicionar: {checkout.bump_product.name}
                    </label>
                    <p className="text-sm text-muted-foreground">
                      +{formatCentsToBRL(checkout.bump_product.price)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-primary">{formatCentsToBRL(totalAmount())}</span>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Pagar agora"
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Pagamento seguro via Stripe
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
