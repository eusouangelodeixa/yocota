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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
  const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    console.error("UazAPI not configured");
    return new Response(JSON.stringify({ error: "UazAPI not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  try {
    const { order_id, order_item_id } = await req.json();

    if (!order_id || !order_item_id) {
      return new Response(JSON.stringify({ error: "order_id and order_item_id required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check if delivery already exists (idempotency)
    const { data: existingDelivery } = await supabase
      .from("deliveries")
      .select("id, status")
      .eq("order_item_id", order_item_id)
      .eq("status", "sent")
      .maybeSingle();

    if (existingDelivery) {
      console.log("Delivery already sent for order_item:", order_item_id);
      return new Response(JSON.stringify({ success: true, already_sent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get order with customer
    const { data: order } = await supabase
      .from("orders")
      .select("*, customers(*)")
      .eq("id", order_id)
      .single();

    if (!order || !order.customers) {
      console.error("Order or customer not found:", order_id);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Get order item with product
    const { data: orderItem } = await supabase
      .from("order_items")
      .select("*, products(*)")
      .eq("id", order_item_id)
      .single();

    if (!orderItem || !orderItem.products) {
      console.error("Order item not found:", order_item_id);
      return new Response(JSON.stringify({ error: "Order item not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const product = orderItem.products;
    const customer = order.customers;
    const phone = customer.phone;

    // Only deliver if product has delivery_type !== 'none' and customer has phone
    if (product.delivery_type === "none" || !phone) {
      console.log("No delivery needed for product:", product.id, "delivery_type:", product.delivery_type, "phone:", phone);
      // Create a delivery record as "sent" (no action needed)
      await supabase.from("deliveries").insert({
        order_id,
        order_item_id,
        phone: phone || null,
        message: "Sem entrega configurada",
        status: "sent",
      });
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Build delivery message with variable substitution
    let message = product.delivery_message || `Olá {{nome}}! Aqui está seu acesso ao produto {{produto}}.`;
    message = message
      .replace(/\{\{nome\}\}/g, customer.name || "")
      .replace(/\{\{email\}\}/g, customer.email || "")
      .replace(/\{\{produto\}\}/g, product.name || "");

    // If there's an attachment, append it
    if (product.delivery_attachment) {
      message += `\n\n${product.delivery_attachment}`;
    }

    // Format phone for UazAPI (E.164 without +)
    const cleanPhone = phone.replace(/\D/g, "").replace(/^\+/, "");

    // Create pending delivery record
    const { data: delivery, error: deliveryError } = await supabase
      .from("deliveries")
      .insert({
        order_id,
        order_item_id,
        phone: cleanPhone,
        message,
        status: "pending",
      })
      .select("id")
      .single();

    if (deliveryError) {
      console.error("Failed to create delivery record:", deliveryError);
      return new Response(JSON.stringify({ error: "Failed to create delivery" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Send via UazAPI with retry logic
    let sent = false;
    const delays = [0, 60000, 300000]; // 0s, 1min, 5min
    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(delays[attempt], 5000))); // Cap at 5s in edge fn
      }

      try {
        const uazRes = await fetch(`${UAZAPI_URL}/send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${UAZAPI_TOKEN}`,
          },
          body: JSON.stringify({
            phone: cleanPhone,
            message,
          }),
        });

        if (uazRes.ok) {
          sent = true;
          break;
        } else {
          const errBody = await uazRes.text();
          lastError = `UazAPI ${uazRes.status}: ${errBody}`;
          console.warn(`Delivery attempt ${attempt + 1} failed:`, lastError);
        }
      } catch (e: any) {
        lastError = e.message;
        console.warn(`Delivery attempt ${attempt + 1} error:`, e.message);
      }
    }

    // Update delivery status
    await supabase
      .from("deliveries")
      .update({ status: sent ? "sent" : "failed" })
      .eq("id", delivery.id);

    if (!sent) {
      console.error("All delivery attempts failed:", lastError);
      return new Response(JSON.stringify({ error: "Delivery failed after retries", details: lastError }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    console.log("Delivery sent successfully for order_item:", order_item_id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("delivery-send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
