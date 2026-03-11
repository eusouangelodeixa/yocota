import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RecoverPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "redirecting" | "expired" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }

    async function recover() {
      // Find abandoned checkout by recovery token
      const { data: abandoned, error } = await supabase
        .from("abandoned_checkouts")
        .select("*, checkouts(checkout_slug)")
        .eq("recovery_token", token)
        .maybeSingle();

      if (error || !abandoned) {
        setState("error");
        return;
      }

      // Check if token expired
      if (abandoned.token_expires_at && new Date(abandoned.token_expires_at) < new Date()) {
        setState("expired");
        return;
      }

      // Check if already recovered
      if (abandoned.recovered) {
        setState("expired");
        return;
      }

      const slug = abandoned.checkouts?.checkout_slug;
      if (!slug) {
        setState("error");
        return;
      }

      // Pre-fill data in sessionStorage for the checkout to pick up
      const prefillData = {
        name: abandoned.name || "",
        email: abandoned.email || "",
        phone: abandoned.phone || "",
        recovery_token: token,
      };
      sessionStorage.setItem("checkout_recovery", JSON.stringify(prefillData));

      // Restore UTM data if available
      if (abandoned.utm_data && typeof abandoned.utm_data === "object") {
        sessionStorage.setItem("checkout_utms", JSON.stringify(abandoned.utm_data));
      }

      setState("redirecting");
      navigate(`/checkout/${slug}`, { replace: true });
    }

    recover();
  }, [token, navigate]);

  if (state === "loading" || state === "redirecting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            {state === "loading" ? "Verificando link..." : "Redirecionando para o checkout..."}
          </p>
        </div>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="py-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Link expirado</h2>
            <p className="text-sm text-muted-foreground">
              Este link de recuperação já expirou ou já foi utilizado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="py-8 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
          <p className="text-sm text-muted-foreground">
            Este link de recuperação não é válido.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
