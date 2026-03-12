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

    // Verify caller is super admin
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) throw new Error("Não autorizado");
    if (caller.email !== SUPER_ADMIN_EMAIL) throw new Error("Apenas o administrador principal pode remover usuários");

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id é obrigatório");

    // Prevent self-removal
    if (user_id === caller.id) throw new Error("Você não pode remover a si mesmo");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Remove admin role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", user_id)
      .eq("role", "admin");
    if (roleError) throw roleError;

    // Delete the user account entirely
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
