import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Save, Upload, X, Eye, EyeOff, ExternalLink, Camera, UserPlus, Trash2, CheckCircle2, XCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const SUPER_ADMIN_EMAIL = "eusouangelodeixa@gmail.com";

function SectionCard({ title, description, children, status }: { title: string; description?: string; children: React.ReactNode; status?: "active" | "inactive" }) {
  return (
    <div className="card-surface rounded-[10px] overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {status && (
          <Badge className={status === "active"
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 gap-1"
            : "bg-muted text-muted-foreground border-border hover:bg-muted gap-1"
          }>
            {status === "active" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {status === "active" ? "Ativo" : "Não configurado"}
          </Badge>
        )}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function SecretInput({ label, value, onChange, placeholder, helpUrl, helpLabel }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; helpUrl?: string; helpLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {helpUrl && (
          <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
            {helpLabel || "Onde encontrar?"} <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
          </a>
        )}
      </div>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "••••••••••••"}
          className="flex h-10 w-full rounded-lg border border-border bg-input px-3 pr-10 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-all duration-150"
        />
        <button type="button" onClick={() => setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150">
          {visible ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").eq("id", SETTINGS_ID).single();
      if (error) throw error;
      return data;
    },
  });

  // Load profile data
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      // If no profile exists, create one
      if (!data) {
        const { data: newProfile, error: insertError } = await supabase.from("profiles").insert({
          user_id: user!.id,
          display_name: user!.email?.split("@")[0] || "",
        }).select().single();
        if (insertError) throw insertError;
        return newProfile;
      }
      return data;
    },
  });

  const [brandForm, setBrandForm] = useState({
    business_name: "", logo_url: "", default_redirect_url: "",
    default_primary_color: "#28d56a", default_accent_color: "#1e40af",
    default_bg_color: "#0d0d0d", default_cta_text: "Finalizar compra",
  });

  useEffect(() => {
    if (settings) {
      setBrandForm({
        business_name: settings.business_name || "", logo_url: settings.logo_url || "",
        default_redirect_url: settings.default_redirect_url || "",
        default_primary_color: settings.default_primary_color || "#28d56a",
        default_accent_color: settings.default_accent_color || "#1e40af",
        default_bg_color: settings.default_bg_color || "#0d0d0d",
        default_cta_text: settings.default_cta_text || "Finalizar compra",
      });
    }
  }, [settings]);

  const saveBrandMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_settings").update({ ...brandForm, updated_at: new Date().toISOString() }).eq("id", SETTINGS_ID);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["site_settings"] }); toast.success("Configurações salvas!"); },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const [apiKeys, setApiKeys] = useState({
    stripe_secret: "", stripe_webhook_secret: "",
    uazapi_url: "", uazapi_token: "", utmify_api_key: "",
  });

  // Check which API keys are configured
  const { data: configuredKeys } = useQuery({
    queryKey: ["configured_api_keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("key_name");
      if (error) throw error;
      const names = new Set(data?.map((k: any) => k.key_name) || []);
      return {
        stripe: names.has("STRIPE_SECRET_KEY"),
        stripe_webhook: names.has("STRIPE_WEBHOOK_SECRET"),
        uazapi: names.has("UAZAPI_URL") && names.has("UAZAPI_TOKEN"),
        utmify: names.has("UTMIFY_API_KEY"),
      };
    },
  });

  const saveApiKeysMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("update-secrets", { body: apiKeys });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Chaves de API salvas com sucesso!");
      setApiKeys({ stripe_secret: "", stripe_webhook_secret: "", uazapi_url: "", uazapi_token: "", utmify_api_key: "" });
      queryClient.invalidateQueries({ queryKey: ["configured_api_keys"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar chaves: " + e.message),
  });

  // Profile form
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    phone: "",
    email: user?.email || "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (user?.email) setProfileForm((f) => ({ ...f, email: user.email || "" }));
  }, [user]);

  useEffect(() => {
    if (profile) {
      setProfileForm((f) => ({
        ...f,
        display_name: (profile as any).display_name || "",
        phone: (profile as any).phone || "",
      }));
    }
  }, [profile]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      // Update profile table
      const { error: profileError } = await supabase.from("profiles").update({
        display_name: profileForm.display_name,
        phone: profileForm.phone,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user!.id);
      if (profileError) throw profileError;

      // Update password if provided
      if (profileForm.newPassword) {
        if (profileForm.newPassword !== profileForm.confirmPassword) throw new Error("As senhas não coincidem");
        if (profileForm.newPassword.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
        const { error } = await supabase.auth.updateUser({ password: profileForm.newPassword });
        if (error) throw error;
      }

      // Update email if changed
      if (profileForm.email !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email: profileForm.email });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Dados atualizados!");
      setProfileForm((f) => ({ ...f, newPassword: "", confirmPassword: "" }));
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `avatar-${user.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const { error: updateError } = await supabase.from("profiles").update({
        avatar_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto de perfil atualizada!");
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Logo upload
  const [uploading, setUploading] = useState(false);
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setBrandForm((f) => ({ ...f, logo_url: urlData.publicUrl }));
      toast.success("Logo enviado!");
    } catch (err: any) { toast.error("Erro ao enviar logo: " + err.message); }
    finally { setUploading(false); }
  };

  // Team members (super admin only)
  const { data: teamMembers, isLoading: teamLoading } = useQuery({
    queryKey: ["team_members"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role").eq("role", "admin");
      if (error) throw error;
      // Get profiles for each
      const userIds = data.map((r: any) => r.user_id);
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      if (pErr) throw pErr;
      return data.map((r: any) => {
        const p = profiles?.find((p: any) => p.user_id === r.user_id);
        return { user_id: r.user_id, display_name: p?.display_name || "—", avatar_url: p?.avatar_url };
      });
    },
  });

  const [inviteForm, setInviteForm] = useState({ email: "", password: "" });
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.password) { toast.error("Preencha email e senha"); return; }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", { body: inviteForm });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário convidado com sucesso!");
      setInviteForm({ email: "", password: "" });
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviting(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const profileAvatarUrl = (profile as any)?.avatar_url;
  const profileDisplayName = (profile as any)?.display_name || user?.email?.split("@")[0] || "";

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-foreground">Configurações</h1>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="bg-secondary border border-border p-1 rounded-lg h-auto">
          <TabsTrigger value="integrations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-xs font-medium px-4 py-1.5">Integrações</TabsTrigger>
          <TabsTrigger value="checkout" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-xs font-medium px-4 py-1.5">Checkout</TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-xs font-medium px-4 py-1.5">Minha Conta</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-xs font-medium px-4 py-1.5">Equipe</TabsTrigger>}
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => saveApiKeysMutation.mutate()} disabled={saveApiKeysMutation.isPending} className="h-9 bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 active:scale-[0.98]">
              {saveApiKeysMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />} Salvar Chaves
            </Button>
          </div>

          <SectionCard title="URLs de Webhook" description="Configure essas URLs nos serviços externos">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL Webhook Stripe</Label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`}
                  className="flex h-10 w-full rounded-lg border border-border bg-input px-3 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none cursor-text"
                />
                <Button type="button" variant="outline" size="sm" className="shrink-0 h-10 px-3 text-xs"
                  onClick={() => { navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`); toast.success("URL copiada!"); }}>
                  Copiar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Cole esta URL no <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">painel de Webhooks da Stripe</a>. Eventos: <code className="text-[10px]">payment_intent.succeeded</code>, <code className="text-[10px]">payment_intent.payment_failed</code></p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL Webhook UazAPI</Label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delivery-send`}
                  className="flex h-10 w-full rounded-lg border border-border bg-input px-3 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none cursor-text"
                />
                <Button type="button" variant="outline" size="sm" className="shrink-0 h-10 px-3 text-xs"
                  onClick={() => { navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delivery-send`); toast.success("URL copiada!"); }}>
                  Copiar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Cole esta URL na configuração de webhook da UazAPI</p>
            </div>
          </SectionCard>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Stripe" description="Chaves para processar pagamentos" status={configuredKeys?.stripe ? "active" : "inactive"}>
              <SecretInput label="Secret Key" value={apiKeys.stripe_secret} onChange={(v) => setApiKeys((f) => ({ ...f, stripe_secret: v }))} placeholder="sk_live_..." helpUrl="https://dashboard.stripe.com/apikeys" helpLabel="Dashboard Stripe" />
              <SecretInput label="Webhook Secret" value={apiKeys.stripe_webhook_secret} onChange={(v) => setApiKeys((f) => ({ ...f, stripe_webhook_secret: v }))} placeholder="whsec_..." helpUrl="https://dashboard.stripe.com/webhooks" helpLabel="Stripe Webhooks" />
            </SectionCard>
            <SectionCard title="UazAPI (WhatsApp)" description="Integração para entregas via WhatsApp" status={configuredKeys?.uazapi ? "active" : "inactive"}>
              <SecretInput label="URL da API" value={apiKeys.uazapi_url} onChange={(v) => setApiKeys((f) => ({ ...f, uazapi_url: v }))} placeholder="https://api.uazapi.com/..." />
              <SecretInput label="Token" value={apiKeys.uazapi_token} onChange={(v) => setApiKeys((f) => ({ ...f, uazapi_token: v }))} placeholder="seu-token-uazapi" />
            </SectionCard>
            <SectionCard title="Utmify" description="Tracking e atribuição de UTMs" status={configuredKeys?.utmify ? "active" : "inactive"}>
              <SecretInput label="API Key" value={apiKeys.utmify_api_key} onChange={(v) => setApiKeys((f) => ({ ...f, utmify_api_key: v }))} placeholder="utmify_key_..." helpUrl="https://app.utmify.com.br" helpLabel="Painel Utmify" />
            </SectionCard>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-[11px] text-muted-foreground">
              💡 As chaves são salvas de forma segura no banco de dados e utilizadas pelas funções do sistema.
              Apenas preencha os campos que deseja atualizar — campos vazios serão ignorados.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="checkout" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => saveBrandMutation.mutate()} disabled={saveBrandMutation.isPending} className="h-9 bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 active:scale-[0.98]">
              {saveBrandMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />} Salvar
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Identidade" description="Nome e logo do seu negócio">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome do negócio</Label>
                <Input value={brandForm.business_name} onChange={(e) => setBrandForm((f) => ({ ...f, business_name: e.target.value }))} placeholder="Meu Negócio" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Logo</Label>
                {brandForm.logo_url ? (
                  <div className="relative w-24 h-24 border border-border rounded-lg overflow-hidden bg-input">
                    <img src={brandForm.logo_url} alt="Logo" className="w-full h-full object-contain" />
                    <button onClick={() => setBrandForm((f) => ({ ...f, logo_url: "" }))} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-24 h-24 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 transition-colors duration-150">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Upload className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />}
                  </label>
                )}
              </div>
            </SectionCard>
            <SectionCard title="Padrões de Checkout" description="Valores padrão para novos checkouts">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">URL de redirecionamento padrão</Label>
                <Input value={brandForm.default_redirect_url} onChange={(e) => setBrandForm((f) => ({ ...f, default_redirect_url: e.target.value }))} placeholder="https://suapagina.com/obrigado" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Texto do botão (CTA)</Label>
                <Input value={brandForm.default_cta_text} onChange={(e) => setBrandForm((f) => ({ ...f, default_cta_text: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Cor primária", key: "default_primary_color" as const },
                  { label: "Cor destaque", key: "default_accent_color" as const },
                  { label: "Cor fundo", key: "default_bg_color" as const },
                ].map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">{c.label}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={brandForm[c.key]} onChange={(e) => setBrandForm((f) => ({ ...f, [c.key]: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                      <span className="text-[10px] text-muted-foreground font-mono">{brandForm[c.key]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending} className="h-9 bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 active:scale-[0.98]">
              {saveProfileMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />} Atualizar
            </Button>
          </div>
          <div className="max-w-lg space-y-6">
            {/* Avatar section */}
            <SectionCard title="Foto de Perfil" description="Clique para alterar sua foto">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <Avatar className="w-20 h-20">
                    {profileAvatarUrl && <AvatarImage src={profileAvatarUrl} alt={profileDisplayName} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                      {profileDisplayName[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" strokeWidth={1.5} />}
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{profileDisplayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Dados Pessoais" description="Altere suas informações pessoais">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome de exibição</Label>
                <Input value={profileForm.display_name} onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Seu nome" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+55 11 99999-9999" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input type="email" value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </SectionCard>

            <SectionCard title="Segurança" description="Altere sua senha de acesso">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nova senha</Label>
                <Input type="password" value={profileForm.newPassword} onChange={(e) => setProfileForm((f) => ({ ...f, newPassword: e.target.value }))} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
                <Input type="password" value={profileForm.confirmPassword} onChange={(e) => setProfileForm((f) => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repita a senha" />
              </div>
            </SectionCard>
          </div>
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="team" className="space-y-6">
            <div className="max-w-lg space-y-6">
              <SectionCard title="Convidar Administrador" description="Crie um novo usuário com acesso admin">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} placeholder="novo@admin.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Senha inicial</Label>
                  <Input type="password" value={inviteForm.password} onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                </div>
                <Button onClick={handleInvite} disabled={inviting} className="h-9 bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 active:scale-[0.98]">
                  {inviting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />} Convidar
                </Button>
              </SectionCard>

              <SectionCard title="Administradores" description="Usuários com acesso ao painel">
                {teamLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-3">
                    {teamMembers?.map((member: any) => (
                      <div key={member.user_id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                              {(member.display_name || "?")[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-foreground">{member.display_name}</span>
                        </div>
                      </div>
                    ))}
                    {(!teamMembers || teamMembers.length === 0) && (
                      <p className="text-xs text-muted-foreground">Nenhum administrador encontrado.</p>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
