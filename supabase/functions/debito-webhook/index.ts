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
    console.log(`Received Débito Webhook [${walletParam || 'unknown'}-${typeParam || 'unknown'}]:`, JSON.stringify(payload));

    // Normalise all common field names from Débito payloads
    const { status, state, debito_reference, reference, transaction_id, type } = payload;
    const finalStatus = (status || state || "").toUpperCase();
    const finalRef = debito_reference || reference || null;

    // 1. ALWAYS audit log first — even if we can't find the order
    // This is critical for debugging unknown payload formats
    await supabase.from("audit_logs").insert({
      event_type: `debito_webhook_${finalStatus?.toLowerCase() || 'unknown'}`,
      payload: payload,
    });

    if (!finalRef) {
      // Débito may only send transaction_id (numeric) without a text reference.
      // Log it and return 200 so Débito doesn't retry forever.
      console.warn(`Webhook sem referência de texto. transaction_id recebido: ${transaction_id}. Payload completo já registado em audit_logs.`);
      return new Response(JSON.stringify({ received: true, warning: "No text reference in payload — logged for inspection" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Find the order (Try both debito_reference AND provider_order_id)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*), customers(name, email, phone)")
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
    // NOTE: M-Pesa returns "SUCCESSFUL", eMola may return "SUCCESS" or other variants
    if (finalStatus === "SUCCESS" || finalStatus === "PAID" || finalStatus === "COMPLETED" || finalStatus === "SUCCESSFUL") {
      if (order.status !== "paid") {
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "paid" })
          .eq("id", order.id);

        if (updateError) throw updateError;

        console.log(`Order ${order.id} marked as paid via webhook`);

        // Create offer session if needed
        const { data: checkout } = await supabase.from("checkouts").select("first_offer_id, product_id").eq("id", order.checkout_id).single();
        if (checkout?.first_offer_id && order.customer_id) {
          const { data: existingOffer } = await supabase.from("offer_sessions").select("id").eq("order_id", order.id).maybeSingle();
          if (!existingOffer) {
            await supabase.from("offer_sessions").insert({ offer_id: checkout.first_offer_id, order_id: order.id, customer_id: order.customer_id, debito_reference: finalRef });
            console.log(`Offer session created for order ${order.id}`);
          }
        }

        // 4. Ensure order_items exist, create them if not (e-Mola async: webhook fires before polling creates items)
        let itemsToDeliver = order.order_items || [];
        if (itemsToDeliver.length === 0 && checkout?.product_id) {
          console.log(`No order_items found for order ${order.id}, creating from checkout...`);
          const productsToCreate: { id: string; type: string }[] = [
            { id: checkout.product_id, type: "main" }
          ];
          const selectedBumps = (order as any).selected_bumps as string[] | null;
          if (selectedBumps && selectedBumps.length > 0) {
            selectedBumps.forEach((bumpId: string) => productsToCreate.push({ id: bumpId, type: "bump" }));
          }
          for (const prod of productsToCreate) {
            const { data: prodData } = await supabase.from("products").select("price").eq("id", prod.id).single();
            const { data: newItem, error: itemErr } = await supabase.from("order_items").insert({
              order_id: order.id, product_id: prod.id, amount: prodData?.price ?? 1, type: prod.type
            }).select("id").single();
            if (itemErr) console.error(`Failed to create order_item for ${prod.id}:`, itemErr.message);
            if (newItem) itemsToDeliver.push(newItem);
            console.log(`Created order_item ${newItem?.id} for product ${prod.id}`);
          }
        }

        // 5. Trigger delivery
        const deliveryUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`;
        for (const item of itemsToDeliver) {
          try {
            const res = await fetch(deliveryUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ order_id: order.id, order_item_id: item.id }),
            });
            const body = await res.text();
            console.log(`Delivery triggered for item ${item.id}: HTTP ${res.status} — ${body.substring(0, 200)}`);
          } catch (e) {
            console.warn(`Failed to trigger delivery for item ${item.id}:`, e);
          }
        }

        // 6. Send to UTMify (fire-and-forget — never fails the webhook)
        sendDebitoToUtmify(supabase, order).catch((e) =>
          console.warn("[debito-webhook] UTMify send failed (non-fatal):", e)
        );

      } else {
        // Order already marked as paid — still check if deliveries are pending
        console.log(`Order ${order.id} was already paid, checking for pending deliveries...`);
        if (order.order_items && order.order_items.length > 0) {
          const deliveryUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`;
          for (const item of order.order_items) {
            const { data: existingDelivery } = await supabase.from("deliveries").select("id,status").eq("order_item_id", item.id).maybeSingle();
            if (!existingDelivery || existingDelivery.status === "failed") {
              try {
                await fetch(deliveryUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                  body: JSON.stringify({ order_id: order.id, order_item_id: item.id, force: existingDelivery?.status === "failed" }),
                });
                console.log(`Re-triggered delivery for item ${item.id}`);
              } catch (e) { console.warn(e); }
            }
          }
        }
      }
    } else if (finalStatus === "FAILED" || finalStatus === "EXPIRED" || finalStatus === "CANCELLED") {
      await supabase
        .from("orders")
        .update({ status: "failed" })
        .eq("id", order.id);
      console.log(`Order ${order.id} marked as failed via webhook (${finalStatus})`);
    } else {
      console.log(`Webhook recebido com status não processável: ${finalStatus} — nenhuma acção tomada`);
    }

    // ── UPSELL: Also check offer_sessions for this debito_reference ──────────
    if (["SUCCESS", "PAID", "COMPLETED", "SUCCESSFUL"].includes(finalStatus)) {
      const { data: upsellSession } = await supabase
        .from("offer_sessions")
        .select("id, order_id, customer_id, offers:offer_id(product_id)")
        .eq("debito_reference", finalRef)
        .not("decision", "eq", "accepted")  // accept null, rejected, pending — payment confirmed = truth
        .maybeSingle();

      if (upsellSession) {
        console.log(`[debito-webhook] Confirming upsell session ${upsellSession.id}`);
        // Mark offer_session as accepted — OfferFrame polling will detect this
        await supabase.from("offer_sessions").update({
          decision: "accepted", decided_at: new Date().toISOString(),
        }).eq("id", upsellSession.id);

        // Create order_item for the upsell product (DB trigger handles delivery)
        const productId = (upsellSession.offers as any)?.product_id;
        if (productId) {
          const { data: prodData } = await supabase.from("products").select("price").eq("id", productId).single();
          const { error: itemErr } = await supabase.from("order_items").insert({
            order_id: upsellSession.order_id, product_id: productId,
            amount: prodData?.price ?? 1, type: "upsell",
          });
          if (itemErr) console.error("[debito-webhook] Failed to create upsell order_item:", itemErr.message);
          else console.log(`[debito-webhook] Upsell order_item created for product ${productId}`);
        }
      }
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

// ── UTMify Integration (Débito) ───────────────────────────────────────────────

function formatUtcDate(isoDate: string): string {
  const d = new Date(isoDate);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

async function getMznToBrlRate(): Promise<number | null> {
  try {
    const resp = await fetch("https://open.er-api.com/v6/latest/MZN");
    if (!resp.ok) return null;
    const data = await resp.json();
    const rate = data?.rates?.BRL;
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

async function sendDebitoToUtmify(supabase: any, order: any) {
  // 1. Get UTMify API key
  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("key_value")
    .eq("key_name", "UTMIFY_API_KEY")
    .maybeSingle();
  const apiKey = keyRow?.key_value || Deno.env.get("UTMIFY_API_KEY") || null;
  if (!apiKey) {
    console.log("[debito-webhook] UTMify API key not configured, skipping");
    return;
  }

  // Check if UTMify is enabled (defaults to true when not set)
  const { data: enabledRow } = await supabase
    .from("api_keys")
    .select("key_value")
    .eq("key_name", "UTMIFY_ENABLED")
    .maybeSingle();
  const isEnabled = (enabledRow?.key_value ?? "true") !== "false";
  if (!isEnabled) {
    console.log("[debito-webhook] UTMify is disabled (UTMIFY_ENABLED=false), skipping");
    return;
  }

  // 2. Get full order data with products and customer
  const { data: fullOrder } = await supabase
    .from("orders")
    .select("*, order_items(*, products(id, name, price, currency)), customers(name, email, phone)")
    .eq("id", order.id)
    .single();

  if (!fullOrder) {
    console.warn("[debito-webhook] Could not load full order for UTMify");
    return;
  }

  // 3. Convert MZN → BRL (UTMify supports BRL, not MZN)
  const sourceCurrency = (fullOrder.currency || "MZN").toUpperCase();
  let targetAmountCents = fullOrder.total_amount; // already in cents (smallest unit)
  let targetCurrency = sourceCurrency;
  let conversionRate = 1;

  if (sourceCurrency === "MZN") {
    const rate = await getMznToBrlRate();
    if (rate) {
      conversionRate = rate;
      targetAmountCents = Math.round(fullOrder.total_amount * rate);
      targetCurrency = "BRL";
      console.log(`[debito-webhook] UTMify currency converted MZN→BRL @ ${rate}`, {
        order_id: fullOrder.id,
        mzn_cents: fullOrder.total_amount,
        brl_cents: targetAmountCents,
      });
    } else {
      console.warn("[debito-webhook] Could not get MZN→BRL rate, skipping UTMify");
      return;
    }
  }

  // 4. Build products list in target currency
  const products = (fullOrder.order_items || []).map((item: any) => ({
    id: item.products?.id || item.product_id,
    name: item.products?.name || "Product",
    planId: null,
    planName: null,
    quantity: 1,
    priceInCents: Math.round((item.amount ?? item.products?.price ?? 0) * conversionRate),
  }));

  // 5. Build payload
  const payload = {
    orderId: fullOrder.id,
    platform: "Yocota",
    paymentMethod: "pix", // closest UTMify equivalent for mobile wallet payments
    status: "paid",
    createdAt: formatUtcDate(fullOrder.created_at),
    approvedDate: formatUtcDate(fullOrder.created_at),
    refundedAt: null,
    customer: {
      name: fullOrder.customers?.name || "",
      email: fullOrder.customers?.email || "",
      phone: fullOrder.customers?.phone || null,
      document: null,
    },
    products,
    trackingParameters: {
      src: null,
      sck: null,
      utm_source: fullOrder.utm_source || null,
      utm_campaign: fullOrder.utm_campaign || null,
      utm_medium: fullOrder.utm_medium || null,
      utm_content: fullOrder.utm_content || null,
      utm_term: fullOrder.utm_term || null,
    },
    commission: {
      totalPriceInCents: targetAmountCents,
      gatewayFeeInCents: 0,
      userCommissionInCents: targetAmountCents,
      // Per UTMify docs: currency field is optional for BRL — omit it
      ...(targetCurrency !== "BRL" ? { currency: targetCurrency } : {}),
    },
  };

  // 6. Send to UTMify
  const resp = await fetch("https://api.utmify.com.br/api-credentials/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-token": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.error("[debito-webhook] UTMify API error:", resp.status, text);
  } else {
    console.log("[debito-webhook] UTMify order sent:", fullOrder.id, targetCurrency, targetAmountCents / 100);
  }
}
