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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const isSuperAdmin = caller.email === SUPER_ADMIN_EMAIL;

    // Allow super admin OR users with admin role
    let callerIsAdmin = isSuperAdmin;
    if (!isSuperAdmin) {
      const { data: roleRow } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .maybeSingle();
      callerIsAdmin = roleRow?.role === "admin";
    }
    if (!callerIsAdmin) throw new Error("Acesso negado");

    // Get admin user_ids from user_roles
    const { data: roles, error: rolesErr } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (rolesErr) throw rolesErr;

    const userIds = roles?.map((r: any) => r.user_id) || [];

    // Get user emails via admin API
    const { data: { users }, error: usersErr } = await adminClient.auth.admin.listUsers({ perPage: 200 });
    if (usersErr) throw usersErr;

    const members: { user_id: string; email: string; role: string }[] = userIds.map((uid: string) => {
      const u = users.find((u: any) => u.id === uid);
      return { user_id: uid, email: u?.email || "—", role: "admin" };
    });

    // Super admin sees themselves at the top with role "super_admin"
    if (isSuperAdmin) {
      const superAdminUser = users.find((u: any) => u.email === SUPER_ADMIN_EMAIL);
      if (superAdminUser) {
        members.unshift({
          user_id: superAdminUser.id,
          email: superAdminUser.email!,
          role: "super_admin",
        });
      }
    }
    // Regular admin: super admin is filtered out (already not in user_roles results)

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
