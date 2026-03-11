import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Rate Limiting (in-memory per instance) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

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
      .select("*, offers(*, products(*)), orders:order_id(id, status)")
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

    // 4. ANTI-BYPASS: Verify original order is actually paid before allowing upsell
    const order = session.orders;
    if (!order || order.status !== "paid") {
      console.error("[OFFER-DECISION] Anti-bypass: order not paid", {
        order_id: session.order_id,
        order_status: order?.status,
      });

      await supabase.from("audit_logs").insert({
        event_type: "upsell_bypass_attempt",
        payload: {
          token,
          order_id: session.order_id,
          order_status: order?.status || "not_found",
          decision,
        },
      });

      return new Response(JSON.stringify({ error: "Pedido original não confirmado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const offer = session.offers;
    const product = offer.products;

    let stripePaymentIntentId: string | null = null;

    if (decision === "accepted") {
      // 5. Get customer's saved payment method
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

      // 6. One-click charge via Stripe off-session with idempotency key
      try {
        const idempotencyKey = `upsell_${session.id}_${offer.id}`;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: product.price,
          currency: product.currency || "brl",
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
        }, {
          idempotencyKey,
        });

        stripePaymentIntentId = paymentIntent.id;

        // 7. Create order item for the upsell
        const { data: upsellItem } = await supabase.from("order_items").insert({
          order_id: session.order_id,
          product_id: product.id,
          amount: product.price,
          type: "upsell",
        }).select("id").single();

        // Trigger delivery for upsell product
        if (upsellItem) {
          try {
            const deliveryUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`;
            await fetch(deliveryUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ order_id: session.order_id, order_item_id: upsellItem.id }),
            });
          } catch (e) {
            console.warn("Failed to trigger upsell delivery:", e);
          }
        }

        // 8. Update order total
        const { data: orderData } = await supabase
          .from("orders")
          .select("total_amount")
          .eq("id", session.order_id)
          .single();

        if (orderData) {
          await supabase
            .from("orders")
            .update({ total_amount: orderData.total_amount + product.price })
            .eq("id", session.order_id);
        }

        // Audit log: upsell accepted
        await supabase.from("audit_logs").insert({
          event_type: "upsell_accepted",
          payload: {
            offer_session_id: session.id,
            offer_id: offer.id,
            order_id: session.order_id,
            product_id: product.id,
            amount: product.price,
            payment_intent_id: paymentIntent.id,
          },
        });
      } catch (stripeError: any) {
        console.error("Stripe off-session charge failed:", stripeError);
        await supabase
          .from("offer_sessions")
          .update({ decision: "failed", decided_at: new Date().toISOString() })
          .eq("id", session.id);

        // Audit log: upsell payment failed
        await supabase.from("audit_logs").insert({
          event_type: "upsell_payment_failed",
          payload: {
            offer_session_id: session.id,
            offer_id: offer.id,
            error: stripeError.message,
          },
        });

        return new Response(JSON.stringify({ error: "Falha no pagamento: " + stripeError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402,
        });
      }
    } else {
      // Audit log: upsell declined
      await supabase.from("audit_logs").insert({
        event_type: "upsell_declined",
        payload: {
          offer_session_id: session.id,
          offer_id: offer.id,
          order_id: session.order_id,
        },
      });
    }

    // 9. Mark session as decided
    await supabase
      .from("offer_sessions")
      .update({
        decision,
        decided_at: new Date().toISOString(),
        stripe_payment_intent_id: stripePaymentIntentId,
      })
      .eq("id", session.id);

    // 10. Determine next offer
    const nextOfferId = decision === "accepted"
      ? offer.accept_next_offer_id
      : offer.reject_next_offer_id;

    let nextOfferUrl: string | null = null;
    let nextOfferPageUrl: string | null = null;
    let nextOfferToken: string | null = null;

    if (nextOfferId) {
      const { data: nextOffer } = await supabase
        .from("offers")
        .select("page_url")
        .eq("id", nextOfferId)
        .single();

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
        nextOfferToken = nextSession.token;
        nextOfferPageUrl = nextOffer?.page_url || null;
        const origin = req.headers.get("origin") || "";
        nextOfferUrl = `${origin}/offer-frame/${nextSession.token}`;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      decision,
      next_offer_url: nextOfferUrl,
      next_offer_page_url: nextOfferPageUrl,
      next_offer_token: nextOfferToken,
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
