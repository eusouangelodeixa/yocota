import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function useDocTitle(title: string) {
  useEffect(() => { document.title = title; return () => { document.title = "Yocota"; }; }, [title]);
}

export default function RecoverPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "redirecting" | "expired" | "error">("loading");

  useEffect(() => {
    if (!token) { setState("error"); return; }
    async function recover() {
      const { data: abandoned, error } = await supabase.from("abandoned_checkouts").select("*, checkouts(checkout_slug)").eq("recovery_token", token).maybeSingle();
      if (error || !abandoned) { setState("error"); return; }
      if (abandoned.token_expires_at && new Date(abandoned.token_expires_at) < new Date()) { setState("expired"); return; }
      if (abandoned.recovered) { setState("expired"); return; }
      const slug = abandoned.checkouts?.checkout_slug;
      if (!slug) { setState("error"); return; }
      sessionStorage.setItem("checkout_recovery", JSON.stringify({ name: abandoned.name || "", email: abandoned.email || "", phone: abandoned.phone || "", recovery_token: token }));
      if (abandoned.utm_data && typeof abandoned.utm_data === "object") sessionStorage.setItem("checkout_utms", JSON.stringify(abandoned.utm_data));
      setState("redirecting");
      navigate(`/checkout/${slug}`, { replace: true });
    }
    recover();
  }, [token, navigate]);

  if (state === "loading" || state === "redirecting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-[13px] text-muted-foreground">{state === "loading" ? "Verificando link..." : "Redirecionando..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-surface rounded-[10px] p-8 text-center max-w-sm w-full space-y-3">
        <h2 className="text-lg font-bold text-foreground">{state === "expired" ? "Link expirado" : "Link inválido"}</h2>
        <p className="text-[13px] text-muted-foreground">
          {state === "expired" ? "Este link de recuperação já expirou ou já foi utilizado." : "Este link de recuperação não é válido."}
        </p>
      </div>
    </div>
  );
}
