import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let stripeKey = "";
    const { data: keyRow } = await supabase.from("api_keys").select("key_value").eq("key_name", "STRIPE_SECRET_KEY").maybeSingle();
    if (keyRow?.key_value) stripeKey = keyRow.key_value;
    if (!stripeKey) stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Simple test: list 1 customer
    const customers = await stripe.customers.list({ limit: 1 });

    return new Response(JSON.stringify({
      success: true,
      stripe_connected: true,
      account_test: `Found ${customers.data.length} customer(s)`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
