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

    const { checkout_id, customer_name, customer_email, customer_phone, selected_bump_ids, utm_data } = await req.json();

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

    const currency = checkout.products.currency || "brl";

    // Calculate total amount
    let totalAmount = checkout.products.price;
    const bumpIds: string[] = selected_bump_ids || [];
    let validBumpProducts: any[] = [];

    if (bumpIds.length > 0) {
      // Verify bumps belong to this checkout
      const { data: validBumps } = await supabase
        .from("checkout_order_bumps")
        .select("product_id")
        .eq("checkout_id", checkout_id);

      const validBumpIdSet = new Set((validBumps || []).map((b: any) => b.product_id));
      
      // Also allow legacy single bump
      if (checkout.order_bump_product_id) {
        validBumpIdSet.add(checkout.order_bump_product_id);
      }

      const filteredBumpIds = bumpIds.filter((id: string) => validBumpIdSet.has(id));

      if (filteredBumpIds.length > 0) {
        const { data: bumpProducts } = await supabase
          .from("products")
          .select("id, name, price, currency")
          .in("id", filteredBumpIds);

        validBumpProducts = bumpProducts || [];
        for (const bp of validBumpProducts) {
          totalAmount += bp.price;
        }
      }
    }

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      // Update name if needed
      await stripe.customers.update(customerId, {
        name: customer_name,
        phone: customer_phone || undefined,
      });
    } else {
      const newCustomer = await stripe.customers.create({
        email: customer_email,
        name: customer_name,
        phone: customer_phone || undefined,
      });
      customerId = newCustomer.id;
    }

    // Build description for the payment
    let description = checkout.products.name;
    if (validBumpProducts.length > 0) {
      description += " + " + validBumpProducts.map((bp: any) => bp.name).join(" + ");
    }

    // Create PaymentIntent
    const piConfig: any = {
      amount: totalAmount,
      currency: currency,
      customer: customerId,
      description,
      metadata: {
        checkout_id: checkout.id,
        customer_name,
        customer_email,
        customer_phone: customer_phone || "",
        selected_bump_ids: JSON.stringify(bumpIds),
        utm_source: utm_data?.utm_source || "",
        utm_medium: utm_data?.utm_medium || "",
        utm_campaign: utm_data?.utm_campaign || "",
        utm_content: utm_data?.utm_content || "",
        utm_term: utm_data?.utm_term || "",
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    };

    // Save payment method for future upsell one-click charges
    if (checkout.first_offer_id) {
      piConfig.setup_future_usage = "off_session";
    }

    const paymentIntent = await stripe.paymentIntents.create(piConfig);

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    }), {
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
