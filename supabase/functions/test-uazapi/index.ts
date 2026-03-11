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
    return new Response(JSON.stringify({ error: "UazAPI not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  try {
    const { phone, message } = await req.json();
    const cleanPhone = phone.replace(/\D/g, "").replace(/^\+/, "");

    // Try all possible path + body combos with "token" header
    const attempts = [
      { path: "/message/send-text", body: { number: cleanPhone, text: message } },
      { path: "/message/send-text", body: { number: cleanPhone, text: message, delay: 0 } },
      { path: "/chat/send", body: { number: cleanPhone, text: message } },
      { path: "/send/text", body: { number: cleanPhone, text: message } },
      { path: "/message/text", body: { number: cleanPhone, text: message } },
      { path: "/messages/text", body: { number: cleanPhone, text: message } },
    ];

    const results: any[] = [];

    for (const a of attempts) {
      const url = `${UAZAPI_URL}${a.path}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": UAZAPI_TOKEN,
          },
          body: JSON.stringify(a.body),
        });
        const resBody = await res.text();
        results.push({ url, status: res.status, response: resBody.substring(0, 300), success: res.ok });
        if (res.ok) break;
      } catch (e: any) {
        results.push({ url, error: e.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
