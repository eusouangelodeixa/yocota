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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get Stripe key: api_keys table first, then env var fallback
    let stripeKey = "";
    {
      const { data: keyRow } = await supabase.from("api_keys").select("key_value").eq("key_name", "STRIPE_SECRET_KEY").maybeSingle();
      if (keyRow?.key_value) stripeKey = keyRow.key_value;
    }
    if (!stripeKey) stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Verify auth (admin only)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { productId, action } = await req.json();

    // Get product from DB
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (action === "create") {
      // Create Stripe product
      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description || undefined,
        metadata: { supabase_id: product.id },
      });

      // Create Stripe price
      const stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: product.price,
        currency: product.currency || "eur",
      });

      // Update product with Stripe IDs
      await supabase
        .from("products")
        .update({
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id,
        })
        .eq("id", productId);

      return new Response(
        JSON.stringify({ stripe_product_id: stripeProduct.id, stripe_price_id: stripePrice.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else if (action === "update") {
      if (product.stripe_product_id) {
        // Update product metadata (name, description)
        await stripe.products.update(product.stripe_product_id, {
          name: product.name,
          description: product.description || undefined,
        });

        // Check if price/currency changed — Stripe prices are immutable, so create a new one
        if (product.stripe_price_id) {
          const existingPrice = await stripe.prices.retrieve(product.stripe_price_id);
          const priceChanged = existingPrice.unit_amount !== product.price || existingPrice.currency !== (product.currency || "eur");

          if (priceChanged) {
            // Create new price
            const newPrice = await stripe.prices.create({
              product: product.stripe_product_id,
              unit_amount: product.price,
              currency: product.currency || "eur",
            });

            // Deactivate old price
            await stripe.prices.update(product.stripe_price_id, { active: false });

            // Update DB with new price ID
            await supabase
              .from("products")
              .update({ stripe_price_id: newPrice.id })
              .eq("id", productId);
          }
        }
      } else {
        // No Stripe product yet — create it
        const stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description || undefined,
          metadata: { supabase_id: product.id },
        });

        const stripePrice = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: product.price,
          currency: product.currency || "eur",
        });

        await supabase
          .from("products")
          .update({
            stripe_product_id: stripeProduct.id,
            stripe_price_id: stripePrice.id,
          })
          .eq("id", productId);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else if (action === "archive") {
      // Archive Stripe product (deactivates it and its prices)
      if (product.stripe_product_id) {
        if (product.stripe_price_id) {
          try { await stripe.prices.update(product.stripe_price_id, { active: false }); } catch (e) { console.error("Price deactivation error:", e); }
        }
        await stripe.products.update(product.stripe_product_id, { active: false });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error) {
    console.error("sync-product error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
