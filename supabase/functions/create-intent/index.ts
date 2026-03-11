import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Rate Limiting (in-memory per instance) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

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

// --- Input Sanitization Helpers ---
function sanitizeString(val: unknown, maxLen = 255): string {
  if (typeof val !== "string") return "";
  return val.trim().replace(/[<>"'`;]/g, "").substring(0, maxLen);
}

function sanitizeEmail(val: unknown): string {
  const s = sanitizeString(val, 320);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(s) ? s.toLowerCase() : "";
}

function sanitizePhone(val: unknown): string {
  if (typeof val !== "string") return "";
  return val.replace(/[^0-9+\-() ]/g, "").substring(0, 30);
}

function sanitizeUuidArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return val.filter((v) => typeof v === "string" && uuidRegex.test(v));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Rate limit check
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 429,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get Stripe key: api_keys table first (user-configured), then env var fallback
    let stripeKey = "";
    {
      const { data: keyRow } = await supabase.from("api_keys").select("key_value").eq("key_name", "STRIPE_SECRET_KEY").maybeSingle();
      if (keyRow?.key_value) stripeKey = keyRow.key_value;
    }
    if (!stripeKey) stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const rawBody = await req.json();

    // --- Sanitize all inputs server-side ---
    const checkout_id = sanitizeString(rawBody.checkout_id);
    const customer_name = sanitizeString(rawBody.customer_name, 100);
    const customer_email = sanitizeEmail(rawBody.customer_email);
    const customer_phone = sanitizePhone(rawBody.customer_phone);
    const selected_bump_ids = sanitizeUuidArray(rawBody.selected_bump_ids);
    const utm_data = rawBody.utm_data && typeof rawBody.utm_data === "object" ? {
      utm_source: sanitizeString(rawBody.utm_data?.utm_source, 100),
      utm_medium: sanitizeString(rawBody.utm_data?.utm_medium, 100),
      utm_campaign: sanitizeString(rawBody.utm_data?.utm_campaign, 100),
      utm_content: sanitizeString(rawBody.utm_data?.utm_content, 100),
      utm_term: sanitizeString(rawBody.utm_data?.utm_term, 100),
    } : {};

    // Validate required fields
    if (!checkout_id || !customer_name || !customer_email) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: checkout_id, nome e email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log("[CREATE-INTENT] Sanitized input:", {
      checkout_id,
      customer_name,
      customer_email,
      selected_bump_ids,
      bump_count: selected_bump_ids.length,
    });

    // Get checkout with product (price comes from DB, never from frontend)
    const { data: checkout, error: checkoutError } = await supabase
      .from("checkouts")
      .select("*, products!checkouts_product_id_fkey(id, name, price, currency, stripe_price_id)")
      .eq("id", checkout_id)
      .eq("active", true)
      .single();

    if (checkoutError || !checkout) {
      console.error("[CREATE-INTENT] Checkout not found:", { checkoutError, checkout_id });
      return new Response(JSON.stringify({ error: "Checkout não encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const currency = checkout.products.currency || "eur";

    // Calculate total amount from DB prices only
    let totalAmount = checkout.products.price;
    const bumpIds: string[] = selected_bump_ids;
    let validBumpProducts: any[] = [];

    if (bumpIds.length > 0) {
      const { data: validBumps } = await supabase
        .from("checkout_order_bumps")
        .select("product_id")
        .eq("checkout_id", checkout_id);

      const validBumpIdSet = new Set((validBumps || []).map((b: any) => b.product_id));
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

    console.log("[CREATE-INTENT] Final total (from DB):", {
      mainProduct: checkout.products.price,
      bumpsTotal: totalAmount - checkout.products.price,
      totalAmount,
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
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

    // Build description
    let description = checkout.products.name;
    if (validBumpProducts.length > 0) {
      description += " + " + validBumpProducts.map((bp: any) => bp.name).join(" + ");
    }

    // --- Idempotency key: prevents double charges on double-click/reload ---
    const idempotencyKey = `ci_${checkout_id}_${customer_email}_${totalAmount}_${bumpIds.sort().join(",")}`;

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

    if (checkout.first_offer_id) {
      piConfig.setup_future_usage = "off_session";
    }

    const paymentIntent = await stripe.paymentIntents.create(piConfig, {
      idempotencyKey,
    });

    console.log("[CREATE-INTENT] PaymentIntent created:", {
      pi_id: paymentIntent.id,
      amount: paymentIntent.amount,
      idempotency_key: idempotencyKey,
    });

    // --- Audit log: payment_created ---
    await supabase.from("audit_logs").insert({
      event_type: "payment_created",
      payload: {
        payment_intent_id: paymentIntent.id,
        checkout_id: checkout.id,
        customer_email,
        amount: totalAmount,
        currency,
        bump_count: validBumpProducts.length,
      },
    });

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("create-intent error:", error);

    // Audit log: payment error
    try {
      await supabase.from("audit_logs").insert({
        event_type: "payment_error",
        payload: { error: error.message },
      });
    } catch {}

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
