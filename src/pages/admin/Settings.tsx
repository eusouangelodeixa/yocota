import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2,
  Save,
  Upload,
  X,
  KeyRound,
  User,
  Palette,
  Eye,
  EyeOff,
  ExternalLink,
  Shield,
} from "lucide-react";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

/* ── Helpers ─────────────────────────────────────────────── */

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="card-glass rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function SecretInput({ label, value, onChange, placeholder, helpUrl, helpLabel }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helpUrl?: string;
  helpLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {helpUrl && (
          <a
            href={helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline flex items-center gap-1"
          >
            {helpLabel || "Onde encontrar?"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "••••••••••••"}
          className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary pr-10 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */

export default function Settings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  /* ── Site settings query ── */
  const { data: settings, isLoading } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", SETTINGS_ID)
        .single();
      if (error) throw error;
      return data;
    },
  });

  /* ── Brand / Checkout defaults form ── */
  const [brandForm, setBrandForm] = useState({
    business_name: "",
    logo_url: "",
    default_redirect_url: "",
    default_primary_color: "#28d56a",
    default_accent_color: "#1e40af",
    default_bg_color: "#0d0d0d",
    default_cta_text: "Finalizar compra",
  });

  useEffect(() => {
    if (settings) {
      setBrandForm({
        business_name: settings.business_name || "",
        logo_url: settings.logo_url || "",
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
      const { error } = await supabase
        .from("site_settings")
        .update({ ...brandForm, updated_at: new Date().toISOString() })
        .eq("id", SETTINGS_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site_settings"] });
      toast.success("Configurações salvas!");
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  /* ── API Keys form ── */
  const [apiKeys, setApiKeys] = useState({
    stripe_secret: "",
    stripe_webhook_secret: "",
    uazapi_url: "",
    uazapi_token: "",
    utmify_api_key: "",
  });

  const saveApiKeysMutation = useMutation({
    mutationFn: async () => {
      // Save API keys via edge function that updates secrets
      const { error } = await supabase.functions.invoke("update-secrets", {
        body: apiKeys,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Chaves de API atualizadas!"),
    onError: (e: any) => toast.error("Erro ao salvar chaves: " + e.message),
  });

  /* ── Profile form ── */
  const [profileForm, setProfileForm] = useState({
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (user?.email) setProfileForm((f) => ({ ...f, email: user.email || "" }));
  }, [user]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (profileForm.newPassword) {
        if (profileForm.newPassword !== profileForm.confirmPassword) {
          throw new Error("As senhas não coincidem");
        }
        if (profileForm.newPassword.length < 6) {
          throw new Error("A senha deve ter pelo menos 6 caracteres");
        }
        const { error } = await supabase.auth.updateUser({
          password: profileForm.newPassword,
        });
        if (error) throw error;
      }
      if (profileForm.email !== user?.email) {
        const { error } = await supabase.auth.updateUser({
          email: profileForm.email,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Dados atualizados!");
      setProfileForm((f) => ({ ...f, currentPassword: "", newPassword: "", confirmPassword: "" }));
    },
    onError: (e: any) => toast.error(e.message),
  });

  /* ── Logo upload ── */
  const [uploading, setUploading] = useState(false);
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
      setBrandForm((f) => ({ ...f, logo_url: urlData.publicUrl }));
      toast.success("Logo enviado!");
    } catch (err: any) {
      toast.error("Erro ao enviar logo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu negócio, integrações e perfil</p>
      </div>

      <Tabs defaultValue="brand" className="space-y-6">
        <TabsList className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] p-1 rounded-lg">
          <TabsTrigger value="brand" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-xs font-medium px-4">
            <Palette className="mr-1.5 h-3.5 w-3.5" /> Marca & Checkout
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-xs font-medium px-4">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Integrações
          </TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-xs font-medium px-4">
            <User className="mr-1.5 h-3.5 w-3.5" /> Minha Conta
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Marca & Checkout ── */}
        <TabsContent value="brand" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => saveBrandMutation.mutate()}
              disabled={saveBrandMutation.isPending}
              className="bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all duration-150"
            >
              {saveBrandMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Identidade" description="Nome e logo do seu negócio">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Nome do negócio</Label>
                <Input
                  value={brandForm.business_name}
                  onChange={(e) => setBrandForm((f) => ({ ...f, business_name: e.target.value }))}
                  placeholder="Meu Negócio"
                  className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Logo</Label>
                {brandForm.logo_url ? (
                  <div className="relative w-28 h-28 border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.02)]">
                    <img src={brandForm.logo_url} alt="Logo" className="w-full h-full object-contain" />
                    <button
                      onClick={() => setBrandForm((f) => ({ ...f, logo_url: "" }))}
                      className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 hover:brightness-110 transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-28 h-28 border border-dashed border-[rgba(255,255,255,0.15)] rounded-xl cursor-pointer hover:border-primary/40 transition-colors duration-150">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                  </label>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Padrões de Checkout" description="Valores padrão para novos checkouts">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">URL de redirecionamento padrão</Label>
                <Input
                  value={brandForm.default_redirect_url}
                  onChange={(e) => setBrandForm((f) => ({ ...f, default_redirect_url: e.target.value }))}
                  placeholder="https://suapagina.com/obrigado"
                  className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Texto do botão (CTA)</Label>
                <Input
                  value={brandForm.default_cta_text}
                  onChange={(e) => setBrandForm((f) => ({ ...f, default_cta_text: e.target.value }))}
                  className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Cor primária", key: "default_primary_color" as const },
                  { label: "Cor destaque", key: "default_accent_color" as const },
                  { label: "Cor fundo", key: "default_bg_color" as const },
                ].map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label className="text-[10px] font-medium text-muted-foreground">{c.label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandForm[c.key]}
                        onChange={(e) => setBrandForm((f) => ({ ...f, [c.key]: e.target.value }))}
                        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">{brandForm[c.key]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* ── Tab: Integrações (API Keys) ── */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => saveApiKeysMutation.mutate()}
              disabled={saveApiKeysMutation.isPending}
              className="bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all duration-150"
            >
              {saveApiKeysMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              Salvar Chaves
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Stripe" description="Chaves para processar pagamentos">
              <SecretInput
                label="Secret Key"
                value={apiKeys.stripe_secret}
                onChange={(v) => setApiKeys((f) => ({ ...f, stripe_secret: v }))}
                placeholder="sk_live_..."
                helpUrl="https://dashboard.stripe.com/apikeys"
                helpLabel="Dashboard Stripe"
              />
              <SecretInput
                label="Webhook Secret"
                value={apiKeys.stripe_webhook_secret}
                onChange={(v) => setApiKeys((f) => ({ ...f, stripe_webhook_secret: v }))}
                placeholder="whsec_..."
                helpUrl="https://dashboard.stripe.com/webhooks"
                helpLabel="Stripe Webhooks"
              />
            </SectionCard>

            <SectionCard title="UazAPI (WhatsApp)" description="Integração para entregas via WhatsApp">
              <SecretInput
                label="URL da API"
                value={apiKeys.uazapi_url}
                onChange={(v) => setApiKeys((f) => ({ ...f, uazapi_url: v }))}
                placeholder="https://api.uazapi.com/..."
              />
              <SecretInput
                label="Token"
                value={apiKeys.uazapi_token}
                onChange={(v) => setApiKeys((f) => ({ ...f, uazapi_token: v }))}
                placeholder="seu-token-uazapi"
              />
            </SectionCard>

            <SectionCard title="Utmify" description="Tracking e atribuição de UTMs">
              <SecretInput
                label="API Key"
                value={apiKeys.utmify_api_key}
                onChange={(v) => setApiKeys((f) => ({ ...f, utmify_api_key: v }))}
                placeholder="utmify_key_..."
                helpUrl="https://app.utmify.com.br"
                helpLabel="Painel Utmify"
              />
            </SectionCard>
          </div>
        </TabsContent>

        {/* ── Tab: Minha Conta ── */}
        <TabsContent value="profile" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => saveProfileMutation.mutate()}
              disabled={saveProfileMutation.isPending}
              className="bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all duration-150"
            >
              {saveProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Atualizar
            </Button>
          </div>

          <div className="max-w-lg">
            <SectionCard title="Dados da Conta" description="Altere seu email ou senha">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                  className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary"
                />
              </div>
              <div className="pt-4 border-t border-[rgba(255,255,255,0.06)] space-y-4">
                <p className="text-xs font-medium text-muted-foreground">Alterar senha</p>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Nova senha</Label>
                  <Input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(e) => setProfileForm((f) => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Confirmar nova senha</Label>
                  <Input
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Repita a senha"
                    className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary"
                  />
                </div>
              </div>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
