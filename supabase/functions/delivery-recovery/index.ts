import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Find paid order_items with no delivery record in the last 48h
    const { data: items, error } = await supabase.rpc("get_undelivered_order_items");

    if (error) {
      // Fallback: use raw query if RPC doesn't exist yet
      console.warn("RPC not found, querying directly:", error.message);
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      // Get all paid order_items in the window
      const { data: allItems } = await supabase
        .from("order_items")
        .select("id, order_id, orders!inner(status)")
        .eq("orders.status", "paid");

      if (!allItems) throw new Error("Could not query order_items");

      // Filter out items that already have a delivery
      const { data: existingDeliveries } = await supabase
        .from("deliveries")
        .select("order_item_id");

      const deliveredIds = new Set((existingDeliveries ?? []).map((d: any) => d.order_item_id));
      const pending = allItems.filter((i: any) => !deliveredIds.has(i.id));

      console.log(`[delivery-recovery] ${pending.length} items without delivery (fallback query)`);
      return await triggerAll(pending, supabase);
    }

    console.log(`[delivery-recovery] ${items?.length ?? 0} undelivered items via RPC`);
    return await triggerAll(items ?? [], supabase);

  } catch (err: any) {
    console.error("[delivery-recovery] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function triggerAll(items: any[], _supabase: any) {
  const deliveryUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let triggered = 0;

  for (const item of items) {
    try {
      const res = await fetch(deliveryUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ order_id: item.order_id, order_item_id: item.id }),
      });
      const body = await res.text();
      console.log(`[delivery-recovery] item ${item.id}: HTTP ${res.status} — ${body.substring(0, 120)}`);
      triggered++;
    } catch (e) {
      console.warn(`[delivery-recovery] Failed item ${item.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ success: true, triggered, total: items.length }), {
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  });
}
