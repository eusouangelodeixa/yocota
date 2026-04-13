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

    // Verify caller identity
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) throw new Error("Não autorizado");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const isSuperAdmin = caller.email === SUPER_ADMIN_EMAIL;

    // Allow super admin OR users with admin role
    if (!isSuperAdmin) {
      const { data: roleRow } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!roleRow || roleRow.role !== "admin") {
        throw new Error("Apenas administradores podem convidar usuários");
      }
    }

    const { email, password } = await req.json();
    if (!email || !password) throw new Error("Email e senha são obrigatórios");
    if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
    // Prevent creating another super admin via this endpoint
    if (email === SUPER_ADMIN_EMAIL) throw new Error("Este email não pode ser utilizado");

    // Create user with service role
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw createError;

    // Assign admin role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: newUser.user!.id,
      role: "admin",
    });
    if (roleError) throw roleError;

    return new Response(JSON.stringify({ success: true, user_id: newUser.user!.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
