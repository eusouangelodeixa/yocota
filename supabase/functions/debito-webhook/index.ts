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

    const url = new URL(req.url);
    const walletParam = url.searchParams.get("wallet");
    const typeParam = url.searchParams.get("type");

    const payload = await req.json();
    console.log(`Received Débito Webhook [${walletParam || 'unknown'}-${typeParam || 'unknown'}]:`, payload);

    // Common fields in Débito C2B/B2C callbacks
    // C2B callbacks often use "reference" for OUR ID and "status" for state
    const { status, state, debito_reference, reference, transaction_id, type } = payload;
    const finalStatus = (status || state || "").toUpperCase();
    const finalRef = debito_reference || reference;

    if (!finalRef) {
      console.error("No reference found in payload");
      return new Response(JSON.stringify({ error: "No reference provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Audit log the webhook
    await supabase.from("audit_logs").insert({
      event_type: `debito_webhook_${finalStatus?.toLowerCase() || 'unknown'}`,
      payload: payload,
    });

    // 2. Find the order (Try both debito_reference AND provider_order_id)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .or(`debito_reference.eq.${finalRef},provider_order_id.eq.${finalRef}`)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      console.warn(`Order not found for reference: ${finalRef}`);
      return new Response(JSON.stringify({ received: true, message: "Order not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Update order status if successful
    if (finalStatus === "SUCCESS" || finalStatus === "PAID" || finalStatus === "COMPLETED") {
      if (order.status !== "paid") {
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "paid" })
          .eq("id", order.id);

        if (updateError) throw updateError;

        console.log(`Order ${order.id} marked as paid via webhook`);

        // 4. Trigger delivery for each item
        if (order.order_items && order.order_items.length > 0) {
          for (const item of order.order_items) {
            try {
              const deliveryUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`;
              await fetch(deliveryUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ order_id: order.id, order_item_id: item.id }),
              });
              console.log(`Triggered delivery for order item ${item.id}`);
            } catch (e) {
              console.warn(`Failed to trigger delivery for item ${item.id}:`, e);
            }
          }
        }
      } else {
        console.log(`Order ${order.id} was already paid, skipping duplicate processing`);
      }
    } else if (status === "FAILED" || status === "EXPIRED" || status === "CANCELLED") {
      await supabase
        .from("orders")
        .update({ status: "failed" })
        .eq("id", order.id);
      console.log(`Order ${order.id} marked as failed via webhook (${status})`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("debito-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
