import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
  const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    return new Response(JSON.stringify({ error: "UazAPI not configured", url: !!UAZAPI_URL, token: !!UAZAPI_TOKEN }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  try {
    const { phone, message, action } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "token": UAZAPI_TOKEN,
    };

    // First check instance status
    if (action === "status" || !phone) {
      const statusRes = await fetch(`${UAZAPI_URL}/instance/status`, { headers: { "token": UAZAPI_TOKEN } });
      const statusBody = await statusRes.text();
      return new Response(JSON.stringify({ 
        action: "status",
        url: `${UAZAPI_URL}/instance/status`,
        status: statusRes.status, 
        response: statusBody 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.replace(/\D/g, "").replace(/^\+/, "");

    // Try sending message
    const sendUrl = `${UAZAPI_URL}/message/send-text`;
    const body = { number: cleanPhone, text: message };

    const res = await fetch(sendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const resBody = await res.text();

    return new Response(JSON.stringify({
      action: "send",
      url: sendUrl,
      requestBody: body,
      status: res.status,
      response: resBody,
      success: res.ok,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
