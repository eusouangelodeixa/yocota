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

    const { checkout_id, customer_name, customer_email, customer_phone, include_bump, utm_data } = await req.json();

    // Get checkout with product
    const { data: checkout, error: checkoutError } = await supabase
      .from("checkouts")
      .select("*, products!checkouts_product_id_fkey(id, name, price, currency, stripe_price_id)")
      .eq("id", checkout_id)
      .eq("active", true)
      .single();

    if (checkoutError || !checkout) {
      return new Response(JSON.stringify({ error: "Checkout não encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const lineItems: any[] = [];
    const currency = checkout.products.currency || "brl";

    // Main product
    if (checkout.products.stripe_price_id) {
      lineItems.push({ price: checkout.products.stripe_price_id, quantity: 1 });
    } else {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: checkout.products.name },
          unit_amount: checkout.products.price,
        },
        quantity: 1,
      });
    }

    // Order bump
    if (include_bump && checkout.order_bump_product_id) {
      const { data: bumpProduct } = await supabase
        .from("products")
        .select("id, name, price, stripe_price_id")
        .eq("id", checkout.order_bump_product_id)
        .single();

      if (bumpProduct) {
        if (bumpProduct.stripe_price_id) {
          lineItems.push({ price: bumpProduct.stripe_price_id, quantity: 1 });
        } else {
          lineItems.push({
            price_data: {
              currency: "brl",
              product_data: { name: bumpProduct.name },
              unit_amount: bumpProduct.price,
            },
            quantity: 1,
          });
        }
      }
    }

    // Check existing Stripe customer
    const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Determine success URL:
    // If checkout has upsell offers, redirect to our success page first
    // Otherwise, redirect directly to the external redirect_url
    const origin = req.headers.get("origin") || "";
    let successUrl: string;

    if (checkout.first_offer_id) {
      // Redirect to our intermediate success page that shows offers
      successUrl = `${origin}/success/${checkout.id}?session_id={CHECKOUT_SESSION_ID}`;
    } else {
      // No offers, redirect directly
      successUrl = `${checkout.redirect_url}?session_id={CHECKOUT_SESSION_ID}`;
    }

    // Create Checkout Session with setup_future_usage to save card for upsells
    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : customer_email,
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: `${origin}/checkout/${checkout.checkout_slug}`,
      metadata: {
        checkout_id: checkout.id,
        customer_name,
        customer_phone: customer_phone || "",
        include_bump: include_bump ? "true" : "false",
        utm_source: utm_data?.utm_source || "",
        utm_medium: utm_data?.utm_medium || "",
        utm_campaign: utm_data?.utm_campaign || "",
        utm_content: utm_data?.utm_content || "",
        utm_term: utm_data?.utm_term || "",
      },
    };

    // Save payment method for future upsell one-click charges
    if (checkout.first_offer_id) {
      sessionConfig.payment_intent_data = {
        setup_future_usage: "off_session",
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("create-intent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
