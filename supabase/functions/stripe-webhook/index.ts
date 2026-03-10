import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
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

  // Mark as processed
  await supabase.from("stripe_webhook_events").insert({ id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const checkoutId = metadata.checkout_id;

        if (!checkoutId) {
          console.log("No checkout_id in metadata, skipping");
          break;
        }

        // Get checkout with products
        const { data: checkout } = await supabase
          .from("checkouts")
          .select("*, products!checkouts_product_id_fkey(id, name, price), first_offer_id")
          .eq("id", checkoutId)
          .single();

        if (!checkout) {
          console.error("Checkout not found:", checkoutId);
          break;
        }

        // Create or find customer
        const customerEmail = session.customer_email || session.customer_details?.email || "";
        const customerName = metadata.customer_name || session.customer_details?.name || "";
        const customerPhone = metadata.customer_phone || "";

        let { data: customer } = await supabase
          .from("customers")
          .select("*")
          .eq("email", customerEmail)
          .maybeSingle();

        // Get Stripe customer's default payment method for one-click upsells
        let stripePaymentMethodId: string | null = null;
        if (session.customer) {
          try {
            const stripeCustomer = await stripe.customers.retrieve(session.customer as string);
            if ('invoice_settings' in stripeCustomer && stripeCustomer.invoice_settings?.default_payment_method) {
              stripePaymentMethodId = stripeCustomer.invoice_settings.default_payment_method as string;
            }
            // If no default, try to get from the session's payment intent
            if (!stripePaymentMethodId && session.payment_intent) {
              const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
              if (pi.payment_method) {
                stripePaymentMethodId = pi.payment_method as string;
                // Set as default for future off-session charges
                await stripe.customers.update(session.customer as string, {
                  invoice_settings: { default_payment_method: stripePaymentMethodId },
                });
              }
            }
          } catch (e) {
            console.warn("Failed to get payment method:", e);
          }
        }

        if (!customer) {
          const { data: newCustomer } = await supabase
            .from("customers")
            .insert({
              name: customerName,
              email: customerEmail,
              phone: customerPhone || null,
              stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
              stripe_payment_method_id: stripePaymentMethodId,
            })
            .select()
            .single();
          customer = newCustomer;
        } else {
          // Update customer with stripe info
          const updates: Record<string, any> = {};
          if (session.customer && !customer.stripe_customer_id) {
            updates.stripe_customer_id = typeof session.customer === "string" ? session.customer : null;
          }
          if (stripePaymentMethodId) {
            updates.stripe_payment_method_id = stripePaymentMethodId;
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from("customers").update(updates).eq("id", customer.id);
          }
        }

        if (!customer) {
          console.error("Failed to create/find customer");
          break;
        }

        // Check for duplicate order
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("stripe_payment_intent_id", session.payment_intent as string)
          .maybeSingle();

        if (existingOrder) {
          console.log("Order already exists for this payment intent, skipping");
          break;
        }

        // Calculate total
        const includeBump = metadata.include_bump === "true";
        let totalAmount = checkout.products.price;

        let bumpProduct = null;
        if (includeBump && checkout.order_bump_product_id) {
          const { data: bp } = await supabase
            .from("products")
            .select("id, price")
            .eq("id", checkout.order_bump_product_id)
            .single();
          if (bp) {
            bumpProduct = bp;
            totalAmount += bp.price;
          }
        }

        // Create order
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_id: customer.id,
            checkout_id: checkout.id,
            total_amount: totalAmount,
            status: "paid",
            stripe_payment_intent_id: session.payment_intent as string,
            utm_source: metadata.utm_source || null,
            utm_medium: metadata.utm_medium || null,
            utm_campaign: metadata.utm_campaign || null,
            utm_content: metadata.utm_content || null,
            utm_term: metadata.utm_term || null,
          })
          .select()
          .single();

        if (orderError) {
          console.error("Failed to create order:", orderError);
          break;
        }

        // Create order items
        const items = [
          {
            order_id: order.id,
            product_id: checkout.products.id,
            amount: checkout.products.price,
            type: "main" as const,
          },
        ];

        if (bumpProduct) {
          items.push({
            order_id: order.id,
            product_id: bumpProduct.id,
            amount: bumpProduct.price,
            type: "bump" as const,
          });
        }

        await supabase.from("order_items").insert(items);

        // Mark abandoned checkout as recovered
        await supabase
          .from("abandoned_checkouts")
          .update({ recovered: true })
          .eq("checkout_id", checkout.id)
          .eq("email", customerEmail);

        // === OFFER ENGINE: Create first offer session if configured ===
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
            // The redirect URL already includes the offer token
            // The success page will handle showing the offer iframe
          }
        }

        console.log("Order created successfully:", order.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await supabase
          .from("orders")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
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
