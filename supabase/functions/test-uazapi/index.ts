import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type UazResponse = {
  ok: boolean;
  status: number;
  text: string;
};

const cleanBaseUrl = (url: string) => url.replace(/\/+$/, "");
const normalizePhone = (phone: string) => (phone || "").replace(/\D/g, "");
const maskSensitive = (content: string) =>
  content
    .replace(/("token"\s*:\s*")([^"]+)(")/gi, "$1***$3")
    .replace(/("qrcode"\s*:\s*")([^"]*)(")/gi, "$1[redacted]$3");

const detectCountry = (phone: string) => {
  if (phone.startsWith("55")) return "BR";
  if (phone.startsWith("258")) return "MZ";
  return "unknown";
};

const callUaz = async (
  baseUrl: string,
  token: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
): Promise<UazResponse> => {
  const response = await fetch(`${cleanBaseUrl(baseUrl)}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    text,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  // Read from api_keys table FIRST, then fall back to env vars
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let UAZAPI_URL = "";
  let UAZAPI_TOKEN = "";
  let urlSource: "api_keys" | "env" | "none" = "none";
  let tokenSource: "api_keys" | "env" | "none" = "none";

  // Try api_keys table first (most recent user-configured values)
  const { data: keys } = await supabase
    .from("api_keys")
    .select("key_name, key_value")
    .in("key_name", ["UAZAPI_URL", "UAZAPI_TOKEN"]);

  if (keys) {
    for (const k of keys) {
      if (k.key_name === "UAZAPI_URL") {
        UAZAPI_URL = k.key_value;
        urlSource = "api_keys";
      }
      if (k.key_name === "UAZAPI_TOKEN") {
        UAZAPI_TOKEN = k.key_value;
        tokenSource = "api_keys";
      }
    }
  }

  // Fall back to env vars
  if (!UAZAPI_URL) {
    UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
    if (UAZAPI_URL) urlSource = "env";
  }
  if (!UAZAPI_TOKEN) {
    UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN") || "";
    if (UAZAPI_TOKEN) tokenSource = "env";
  }

  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    console.error("[test-uazapi] UazAPI not configured", {
      hasUrl: !!UAZAPI_URL,
      hasToken: !!UAZAPI_TOKEN,
      urlSource,
      tokenSource,
    });

    return new Response(JSON.stringify({ error: "UazAPI not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  try {
    const { phone, message } = await req.json();
    const cleanPhone = normalizePhone(phone || "");

    if (!cleanPhone || !message) {
      return new Response(
        JSON.stringify({ error: "phone and message are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const country = detectCountry(cleanPhone);

    console.log("[test-uazapi] Starting diagnostic", {
      cleanPhone,
      country,
      phoneLength: cleanPhone.length,
      urlSource,
      tokenSource,
      uazapiHost: cleanBaseUrl(UAZAPI_URL),
    });

    // Connection probes for root-cause analysis (best effort)
    const probePaths = [
      { name: "instance-status", path: "/instance/status" },
      { name: "status", path: "/status" },
      { name: "session-status", path: "/session/status" },
    ];

    const probes: Array<{
      name: string;
      status: number;
      ok: boolean;
      response: string;
      summary?: Record<string, unknown>;
    }> = [];

    for (const probe of probePaths) {
      try {
        const result = await callUaz(UAZAPI_URL, UAZAPI_TOKEN, probe.path, "GET");

        let summary: Record<string, unknown> | undefined;
        try {
          const parsed = JSON.parse(result.text);
          summary = {};

          if (parsed?.instance?.status) summary.instanceStatus = parsed.instance.status;
          if (parsed?.instance?.name) summary.instanceName = parsed.instance.name;
          if (typeof parsed?.connected_instances === "number") {
            summary.connectedInstances = parsed.connected_instances;
          }
          if (parsed?.status && typeof parsed.status === "string") {
            summary.status = parsed.status;
          }
        } catch {
          // best effort summary only
        }

        probes.push({
          name: probe.name,
          status: result.status,
          ok: result.ok,
          response: maskSensitive(result.text).slice(0, 250),
          summary,
        });
      } catch (err: any) {
        probes.push({
          name: probe.name,
          status: 0,
          ok: false,
          response: `probe_error: ${err?.message || "unknown"}`,
        });
      }
    }

    const sendResult = await callUaz(UAZAPI_URL, UAZAPI_TOKEN, "/send/text", "POST", {
      number: cleanPhone,
      text: message,
    });

    const responsePreview = sendResult.text.slice(0, 500);
    const lowerResponse = responsePreview.toLowerCase();

    let rootCause = "unknown";
    if (sendResult.ok) {
      rootCause = "none";
    } else if (lowerResponse.includes("disconnected")) {
      rootCause = "sender_whatsapp_session_disconnected";
    } else if (lowerResponse.includes("unauthorized") || lowerResponse.includes("token")) {
      rootCause = "invalid_or_expired_api_token";
    } else if (sendResult.status >= 500) {
      rootCause = "uazapi_service_or_instance_error";
    } else if (sendResult.status >= 400) {
      rootCause = "request_rejected_by_uazapi";
    }

    const diagnostics = {
      cleanPhone,
      country,
      phoneLength: cleanPhone.length,
      urlSource,
      tokenSource,
      probes,
      rootCause,
      elapsedMs: Date.now() - startedAt,
      observedAt: new Date().toISOString(),
    };

    console.log("[test-uazapi] Diagnostic result", {
      success: sendResult.ok,
      status: sendResult.status,
      rootCause,
      country,
      elapsedMs: diagnostics.elapsedMs,
    });

    return new Response(
      JSON.stringify({
        url: `${cleanBaseUrl(UAZAPI_URL)}/send/text`,
        status: sendResult.status,
        response: responsePreview,
        success: sendResult.ok,
        diagnostics,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[test-uazapi] Unhandled error", {
      message: error?.message,
      stack: error?.stack,
      elapsedMs: Date.now() - startedAt,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
