import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { offer_id, order_id, customer_id } = await req.json();

    if (!offer_id || !order_id || !customer_id) {
      return new Response(JSON.stringify({ error: "offer_id, order_id e customer_id são obrigatórios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Verify offer exists
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id")
      .eq("id", offer_id)
      .single();

    if (offerError || !offer) {
      return new Response(JSON.stringify({ error: "Oferta não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Create offer session with opaque token
    const { data: session, error: sessionError } = await supabase
      .from("offer_sessions")
      .insert({
        offer_id,
        order_id,
        customer_id,
      })
      .select("token")
      .single();

    if (sessionError) {
      return new Response(JSON.stringify({ error: "Erro ao criar sessão de oferta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const origin = req.headers.get("origin") || "";
    const url = `${origin}/offer-frame/${session.token}`;

    return new Response(JSON.stringify({ url, token: session.token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("generate-offer-url error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
