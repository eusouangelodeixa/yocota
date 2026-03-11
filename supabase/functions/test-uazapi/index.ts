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
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const cleanPhone = phone.replace(/\D/g, "").replace(/^\+/, "");

    // UazAPI v2: header "token" with instance token, endpoint /message/send-text
    const endpoints = [
      { path: "/message/send-text", body: { number: cleanPhone, text: message }, tokenHeader: "token" },
      { path: "/message/send-text", body: { number: cleanPhone, message }, tokenHeader: "token" },
    ];

    const results: any[] = [];

    for (const ep of endpoints) {
      const url = `${UAZAPI_URL}${ep.path}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        [ep.tokenHeader]: UAZAPI_TOKEN,
      };

      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(ep.body),
        });
        const resBody = await res.text();
        results.push({
          url,
          authHeader: ep.authHeader,
          status: res.status,
          response: resBody,
          success: res.ok,
        });

        if (res.ok) break; // Stop on first success
      } catch (e: any) {
        results.push({
          url,
          authHeader: ep.authHeader,
          error: e.message,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
