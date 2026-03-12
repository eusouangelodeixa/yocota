import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "eusouangelodeixa@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) throw new Error("Não autorizado");
    if (caller.email !== SUPER_ADMIN_EMAIL) throw new Error("Acesso negado");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get admin user_ids
    const { data: roles, error: rolesErr } = await adminClient.from("user_roles").select("user_id").eq("role", "admin");
    if (rolesErr) throw rolesErr;

    const userIds = roles?.map((r: any) => r.user_id) || [];
    if (userIds.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get emails from auth.users via admin API
    const { data: { users }, error: usersErr } = await adminClient.auth.admin.listUsers({ perPage: 100 });
    if (usersErr) throw usersErr;

    const members = userIds.map((uid: string) => {
      const u = users.find((u: any) => u.id === uid);
      return { user_id: uid, email: u?.email || "—" };
    });

    return new Response(JSON.stringify(members), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
