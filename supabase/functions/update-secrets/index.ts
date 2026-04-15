import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const SUPER_ADMIN_EMAIL = "eusouangelodeixa@gmail.com";

    // Verify admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    
    if (!roleData && user.email !== SUPER_ADMIN_EMAIL) {
      throw new Error(`Acesso negado: o utilizador ${user.email} não tem permissão de administrador.`);
    }

    const body = await req.json();

    const secretMapping: Record<string, string> = {
      stripe_secret: "STRIPE_SECRET_KEY",
      stripe_webhook_secret: "STRIPE_WEBHOOK_SECRET",
      uazapi_url: "UAZAPI_URL",
      uazapi_token: "UAZAPI_TOKEN",
      utmify_api_key: "UTMIFY_API_KEY",
      utmify_enabled: "UTMIFY_ENABLED",
      debito_mpesa_wallet: "DEBITO_MPESA_WALLET_ID",
      debito_emola_wallet: "DEBITO_EMOLA_WALLET_ID",
      debito_api_token: "DEBITO_API_TOKEN",
    };

    const updates: Record<string, string> = {};
    for (const [formKey, secretName] of Object.entries(secretMapping)) {
      if (body[formKey] && body[formKey].trim()) {
        updates[secretName] = body[formKey].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma chave para atualizar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate key formats
    for (const [key, value] of Object.entries(updates)) {
      if (key === "STRIPE_SECRET_KEY" && !value.startsWith("sk_")) {
        throw new Error("Stripe Secret Key deve começar com 'sk_'");
      }
      if (key === "STRIPE_WEBHOOK_SECRET" && !value.startsWith("whsec_")) {
        throw new Error("Stripe Webhook Secret deve começar com 'whsec_'");
      }
    }

    // Save to api_keys table using service role client
    for (const [keyName, keyValue] of Object.entries(updates)) {
      const { error } = await adminClient.from("api_keys").upsert(
        { key_name: keyName, key_value: keyValue, updated_at: new Date().toISOString() },
        { onConflict: "key_name" }
      );
      if (error) throw new Error(`Erro ao salvar ${keyName}: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ message: "Chaves salvas com sucesso", updated: Object.keys(updates) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("update-secrets error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
