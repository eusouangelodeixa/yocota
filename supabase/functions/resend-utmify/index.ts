import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Get Utmify API key
  const { data: keyData } = await supabase
    .from("api_keys")
    .select("key_value")
    .eq("key_name", "UTMIFY_API_KEY")
    .maybeSingle();
  const apiKey = keyData?.key_value || Deno.env.get("UTMIFY_API_KEY");

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "UTMIFY_API_KEY not configured" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch all paid orders with items and customers
  const { data: orders } = await supabase
    .from("orders")
    .select("*, customers(name, email, phone), order_items(product_id, amount, type, products(id, name, currency))")
    .eq("status", "paid")
    .order("created_at", { ascending: true });

  if (!orders || orders.length === 0) {
    return new Response(JSON.stringify({ error: "No paid orders found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const order of orders) {
    const currency = order.currency || order.order_items?.[0]?.products?.currency || "eur";
    const currencyUpper = currency.toUpperCase();

    const pad = (n: number) => n.toString().padStart(2, "0");
    const formatUtc = (iso: string) => {
      const d = new Date(iso);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    };

    const payload = {
      orderId: order.id,
      platform: "Yocota",
      paymentMethod: "credit_card",
      status: "paid",
      createdAt: formatUtc(order.created_at),
      approvedDate: formatUtc(order.created_at),
      refundedAt: null,
      customer: {
        name: order.customers?.name || "",
        email: order.customers?.email || "",
        phone: order.customers?.phone || null,
        document: null,
      },
      products: (order.order_items || []).map((item: any) => ({
        id: item.products?.id || item.product_id,
        name: item.products?.name || "Product",
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: item.amount,
      })),
      trackingParameters: {
        src: null,
        sck: null,
        utm_source: order.utm_source || null,
        utm_campaign: order.utm_campaign || null,
        utm_medium: order.utm_medium || null,
        utm_content: order.utm_content || null,
        utm_term: order.utm_term || null,
      },
      commission: {
        totalPriceInCents: order.total_amount,
        gatewayFeeInCents: 0,
        userCommissionInCents: order.total_amount,
        currency: currencyUpper,
      },
    };

    try {
      const resp = await fetch("https://api.utmify.com.br/api-credentials/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": apiKey,
        },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      results.push({
        orderId: order.id,
        currency: currencyUpper,
        totalAmount: order.total_amount,
        status: resp.status,
        response: text,
        payloadSent: payload,
      });
    } catch (e) {
      results.push({
        orderId: order.id,
        error: e.message,
      });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
