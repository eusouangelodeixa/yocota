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
    const { abandoned_checkout_id } = await req.json();

    // If called with specific ID, process that one; otherwise process all pending
    let abandonedList: any[] = [];

    if (abandoned_checkout_id) {
      const { data } = await supabase
        .from("abandoned_checkouts")
        .select("*, checkouts(*, products!checkouts_product_id_fkey(name))")
        .eq("id", abandoned_checkout_id)
        .eq("recovered", false)
        .is("whatsapp_sent_at", null)
        .maybeSingle();
      if (data) abandonedList = [data];
    } else {
      // Process all unrecovered, unsent leads created > 10 min ago
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("abandoned_checkouts")
        .select("*, checkouts(*, products!checkouts_product_id_fkey(name))")
        .eq("recovered", false)
        .is("whatsapp_sent_at", null)
        .lt("created_at", tenMinAgo)
        .not("phone", "is", null)
        .limit(50);
      abandonedList = data || [];
    }

    if (abandonedList.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let processed = 0;
    let failed = 0;

    for (const abandoned of abandonedList) {
      // Check if order was already created (recovered)
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("checkout_id", abandoned.checkout_id)
        .eq("status", "paid")
        .maybeSingle();

      if (existingOrder) {
        // Mark as recovered
        await supabase
          .from("abandoned_checkouts")
          .update({ recovered: true })
          .eq("id", abandoned.id);
        continue;
      }

      if (!abandoned.phone) continue;

      // Generate recovery token
      const recoveryToken = crypto.randomUUID();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from("abandoned_checkouts")
        .update({
          recovery_token: recoveryToken,
          token_expires_at: tokenExpiresAt,
        })
        .eq("id", abandoned.id);

      // Build recovery URL
      const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "").replace("https://", "");
      // Use the app URL from referrer or construct from project
      const appUrl = req.headers.get("origin") || `https://${baseUrl}.lovable.app`;
      const recoveryUrl = `${appUrl}/recover/${recoveryToken}`;

      // Build message
      const productName = abandoned.checkouts?.products?.name || "seu produto";
      const customerName = abandoned.name || "Cliente";
      const message = `Olá ${customerName}! 👋\n\nVimos que você se interessou por *${productName}* mas não finalizou a compra.\n\nSeu carrinho ainda está reservado! Clique no link abaixo para continuar de onde parou:\n\n${recoveryUrl}\n\n⏰ O link é válido por 24 horas.`;

      const cleanPhone = abandoned.phone.replace(/\D/g, "").replace(/^\+/, "");

      // Send via UazAPI
      try {
        const uazRes = await fetch(`${UAZAPI_URL}/send/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": UAZAPI_TOKEN,
          },
          body: JSON.stringify({
            number: cleanPhone,
            text: message,
          }),
        });

        if (uazRes.ok) {
          await supabase
            .from("abandoned_checkouts")
            .update({ whatsapp_sent_at: new Date().toISOString() })
            .eq("id", abandoned.id);
          processed++;
          console.log("Recovery message sent to:", cleanPhone);
        } else {
          const errBody = await uazRes.text();
          console.error(`Recovery send failed for ${abandoned.id}:`, errBody);
          failed++;
        }
      } catch (e: any) {
        console.error(`Recovery send error for ${abandoned.id}:`, e.message);
        failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("recovery-send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
