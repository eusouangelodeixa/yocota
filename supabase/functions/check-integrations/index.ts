import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const SUPER_ADMIN_EMAIL = "eusouangelodeixa@gmail.com";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData && user.email !== SUPER_ADMIN_EMAIL) throw new Error("Acesso negado");

    // Check both env vars AND api_keys table
    const { data: dbKeys } = await adminClient.from("api_keys").select("key_name");
    const dbKeyNames = new Set(dbKeys?.map((k: any) => k.key_name) || []);

    const status = {
      stripe: !!(Deno.env.get("STRIPE_SECRET_KEY") || dbKeyNames.has("STRIPE_SECRET_KEY")),
      stripe_webhook: !!(Deno.env.get("STRIPE_WEBHOOK_SECRET") || dbKeyNames.has("STRIPE_WEBHOOK_SECRET")),
      uazapi: !!(
        (Deno.env.get("UAZAPI_URL") || dbKeyNames.has("UAZAPI_URL")) &&
        (Deno.env.get("UAZAPI_TOKEN") || dbKeyNames.has("UAZAPI_TOKEN"))
      ),
      utmify: !!(Deno.env.get("UTMIFY_API_KEY") || dbKeyNames.has("UTMIFY_API_KEY")),
      debito: true, // Hardcoded fallback present in functions
    };

    return new Response(JSON.stringify(status), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
