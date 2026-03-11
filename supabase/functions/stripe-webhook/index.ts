import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Get Stripe keys: api_keys table first (user-configured), then env var fallback
  let stripeKey = "";
  let webhookSecret = "";
  {
    const { data: keys } = await supabase.from("api_keys").select("key_name, key_value").in("key_name", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
    if (keys) {
      for (const k of keys) {
        if (k.key_name === "STRIPE_SECRET_KEY") stripeKey = k.key_value;
        if (k.key_name === "STRIPE_WEBHOOK_SECRET") webhookSecret = k.key_value;
      }
    }
  }
  if (!stripeKey) stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!webhookSecret) webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-08-27.basil",
  });

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Idempotency check
  const { data: existing } = await supabase
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    console.log(`Event ${event.id} already processed, skipping`);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  await supabase.from("stripe_webhook_events").insert({ id: event.id });

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata || {};
        const checkoutId = metadata.checkout_id;

        if (!checkoutId) {
          console.log("No checkout_id in PI metadata, skipping");
          break;
        }

        // Audit log
        await supabase.from("audit_logs").insert({
          event_type: "payment_succeeded",
          payload: {
            payment_intent_id: paymentIntent.id,
            checkout_id: checkoutId,
            amount: paymentIntent.amount,
            customer_email: metadata.customer_email,
          },
        });

        await processSuccessfulPayment(supabase, stripe, {
          checkoutId,
          paymentIntentId: paymentIntent.id,
          customerId: typeof paymentIntent.customer === "string" ? paymentIntent.customer : null,
          paymentMethodId: typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : null,
          customerEmail: metadata.customer_email || "",
          customerName: metadata.customer_name || "",
          customerPhone: metadata.customer_phone || "",
          selectedBumpIds: metadata.selected_bump_ids || "[]",
          utmSource: metadata.utm_source || null,
          utmMedium: metadata.utm_medium || null,
          utmCampaign: metadata.utm_campaign || null,
          utmContent: metadata.utm_content || null,
          utmTerm: metadata.utm_term || null,
        });
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const checkoutId = metadata.checkout_id;

        if (!checkoutId) {
          console.log("No checkout_id in session metadata, skipping");
          break;
        }

        let paymentMethodId: string | null = null;
        let paymentIntentId: string | null = null;
        if (session.payment_intent) {
          paymentIntentId = session.payment_intent as string;
          try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
            paymentMethodId = typeof pi.payment_method === "string" ? pi.payment_method : null;
          } catch (e) {
            console.warn("Failed to retrieve PI:", e);
          }
        }

        const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;

        if (stripeCustomerId && paymentMethodId) {
          try {
            await stripe.customers.update(stripeCustomerId, {
              invoice_settings: { default_payment_method: paymentMethodId },
            });
          } catch (e) {
            console.warn("Failed to set default PM:", e);
          }
        }

        await processSuccessfulPayment(supabase, stripe, {
          checkoutId,
          paymentIntentId,
          customerId: stripeCustomerId,
          paymentMethodId,
          customerEmail: session.customer_email || session.customer_details?.email || "",
          customerName: metadata.customer_name || session.customer_details?.name || "",
          customerPhone: metadata.customer_phone || "",
          selectedBumpIds: metadata.selected_bump_ids || "[]",
          utmSource: metadata.utm_source || null,
          utmMedium: metadata.utm_medium || null,
          utmCampaign: metadata.utm_campaign || null,
          utmContent: metadata.utm_content || null,
          utmTerm: metadata.utm_term || null,
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await supabase
          .from("orders")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        // Audit log
        await supabase.from("audit_logs").insert({
          event_type: "payment_failed",
          payload: {
            payment_intent_id: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message || "unknown",
          },
        });

        console.log("Payment failed for:", paymentIntent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

async function processSuccessfulPayment(
  supabase: any,
  stripe: any,
  params: {
    checkoutId: string;
    paymentIntentId: string | null;
    customerId: string | null;
    paymentMethodId: string | null;
    customerEmail: string;
    customerName: string;
    customerPhone: string;
    selectedBumpIds: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
  }
) {
  const {
    checkoutId, paymentIntentId, customerId, paymentMethodId,
    customerEmail, customerName, customerPhone, selectedBumpIds,
    utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
  } = params;

  const { data: checkout } = await supabase
    .from("checkouts")
    .select("*, products!checkouts_product_id_fkey(id, name, price), first_offer_id")
    .eq("id", checkoutId)
    .single();

  if (!checkout) {
    console.error("Checkout not found:", checkoutId);
    return;
  }

  let { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("email", customerEmail)
    .maybeSingle();

  if (!customer) {
    const { data: newCustomer } = await supabase
      .from("customers")
      .insert({
        name: customerName,
        email: customerEmail,
        phone: customerPhone || null,
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
      })
      .select()
      .single();
    customer = newCustomer;
  } else {
    const updates: Record<string, any> = {};
    if (customerId && !customer.stripe_customer_id) updates.stripe_customer_id = customerId;
    if (paymentMethodId) updates.stripe_payment_method_id = paymentMethodId;
    if (Object.keys(updates).length > 0) {
      await supabase.from("customers").update(updates).eq("id", customer.id);
    }
  }

  if (!customer) {
    console.error("Failed to create/find customer");
    return;
  }

  if (paymentIntentId) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existingOrder) {
      console.log("Order already exists for this payment intent, skipping");
      return;
    }
  }

  let totalAmount = checkout.products.price;
  let bumpProductIds: string[] = [];
  try { bumpProductIds = JSON.parse(selectedBumpIds); } catch { bumpProductIds = []; }

  let bumpProducts: any[] = [];
  if (bumpProductIds.length > 0) {
    const { data: bps } = await supabase
      .from("products")
      .select("id, price")
      .in("id", bumpProductIds);
    bumpProducts = bps || [];
    for (const bp of bumpProducts) totalAmount += bp.price;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      checkout_id: checkout.id,
      total_amount: totalAmount,
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
    })
    .select()
    .single();

  if (orderError) {
    console.error("Failed to create order:", orderError);
    return;
  }

  const items: any[] = [
    { order_id: order.id, product_id: checkout.products.id, amount: checkout.products.price, type: "main" },
  ];
  for (const bp of bumpProducts) {
    items.push({ order_id: order.id, product_id: bp.id, amount: bp.price, type: "bump" });
  }

  const { data: insertedItems } = await supabase.from("order_items").insert(items).select("id, product_id");

  // Mark abandoned checkout as recovered
  await supabase
    .from("abandoned_checkouts")
    .update({ recovered: true })
    .eq("checkout_id", checkout.id)
    .eq("email", customerEmail);

  // Create first offer session if configured
  if (checkout.first_offer_id && customer.id) {
    const { data: offerSession } = await supabase
      .from("offer_sessions")
      .insert({
        offer_id: checkout.first_offer_id,
        order_id: order.id,
        customer_id: customer.id,
      })
      .select("token")
      .single();

    if (offerSession) {
      console.log("Offer session created:", offerSession.token);
    }
  }

  // Set default payment method on Stripe customer
  if (customerId && paymentMethodId) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } catch (e) {
      console.warn("Failed to set default payment method:", e);
    }
  }

  // Trigger deliveries for all order items
  if (insertedItems && insertedItems.length > 0) {
    for (const item of insertedItems) {
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
      } catch (e) {
        console.warn("Failed to trigger delivery for item:", item.id, e);
      }
    }
  }

  console.log("Order created successfully:", order.id);
}
