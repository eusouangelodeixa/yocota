import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Read from api_keys table FIRST, then fall back to env vars
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let UAZAPI_URL = "";
  let UAZAPI_TOKEN = "";

  // Try api_keys table first (most recent user-configured values)
  const { data: keys } = await supabase.from("api_keys").select("key_name, key_value").in("key_name", ["UAZAPI_URL", "UAZAPI_TOKEN"]);
  if (keys) {
    for (const k of keys) {
      if (k.key_name === "UAZAPI_URL") UAZAPI_URL = k.key_value;
      if (k.key_name === "UAZAPI_TOKEN") UAZAPI_TOKEN = k.key_value;
    }
  }

  // Fall back to env vars
  if (!UAZAPI_URL) UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
  if (!UAZAPI_TOKEN) UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN") || "";

  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    return new Response(JSON.stringify({ error: "UazAPI not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  try {
    const { phone, message } = await req.json();
    const cleanPhone = phone.replace(/\D/g, "").replace(/^\+/, "");

    const url = `${UAZAPI_URL}/send/text`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": UAZAPI_TOKEN,
      },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    });
    const resBody = await res.text();
    return new Response(JSON.stringify({ url, status: res.status, response: resBody.substring(0, 500), success: res.ok }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
