import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { token, decision } = await req.json();

    if (!token || !["accepted", "rejected"].includes(decision)) {
      return new Response(JSON.stringify({ error: "Token e decisão são obrigatórios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 1. Load session with offer and product
    const { data: session, error: sessionError } = await supabase
      .from("offer_sessions")
      .select("*, offers(*, products(*))")
      .eq("token", token)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Sessão não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // 2. Check expiry
    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Sessão expirada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 410,
      });
    }

    // 3. Idempotency: already decided
    if (session.decision) {
      return new Response(JSON.stringify({ 
        already_decided: true, 
        decision: session.decision 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const offer = session.offers;
    const product = offer.products;

    let stripePaymentIntentId: string | null = null;

    if (decision === "accepted") {
      // 4. Get customer's saved payment method
      const { data: customer } = await supabase
        .from("customers")
        .select("stripe_customer_id, stripe_payment_method_id")
        .eq("id", session.customer_id)
        .single();

      if (!customer?.stripe_customer_id || !customer?.stripe_payment_method_id) {
        return new Response(JSON.stringify({ error: "Método de pagamento não encontrado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // 5. One-click charge via Stripe off-session
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: product.price,
          currency: "brl",
          customer: customer.stripe_customer_id,
          payment_method: customer.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          metadata: {
            offer_session_id: session.id,
            offer_id: offer.id,
            order_id: session.order_id,
            type: "upsell",
          },
        });

        stripePaymentIntentId = paymentIntent.id;

        // 6. Create order item for the upsell
        await supabase.from("order_items").insert({
          order_id: session.order_id,
          product_id: product.id,
          amount: product.price,
          type: "upsell",
        });

        // 7. Update order total
        const { data: order } = await supabase
          .from("orders")
          .select("total_amount")
          .eq("id", session.order_id)
          .single();

        if (order) {
          await supabase
            .from("orders")
            .update({ total_amount: order.total_amount + product.price })
            .eq("id", session.order_id);
        }
      } catch (stripeError: any) {
        console.error("Stripe off-session charge failed:", stripeError);
        // Mark as failed but don't crash
        await supabase
          .from("offer_sessions")
          .update({ decision: "failed", decided_at: new Date().toISOString() })
          .eq("id", session.id);

        return new Response(JSON.stringify({ error: "Falha no pagamento: " + stripeError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402,
        });
      }
    }

    // 8. Mark session as decided
    await supabase
      .from("offer_sessions")
      .update({
        decision,
        decided_at: new Date().toISOString(),
        stripe_payment_intent_id: stripePaymentIntentId,
      })
      .eq("id", session.id);

    // 9. Determine next offer
    const nextOfferId = decision === "accepted"
      ? offer.accept_next_offer_id
      : offer.reject_next_offer_id;

    let nextOfferUrl: string | null = null;

    if (nextOfferId) {
      // Create a new offer session for the next offer
      const { data: nextSession } = await supabase
        .from("offer_sessions")
        .insert({
          offer_id: nextOfferId,
          order_id: session.order_id,
          customer_id: session.customer_id,
        })
        .select("token")
        .single();

      if (nextSession) {
        const origin = req.headers.get("origin") || Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || "";
        nextOfferUrl = `${origin}/offer-frame/${nextSession.token}`;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      decision,
      next_offer_url: nextOfferUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("offer-decision error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
