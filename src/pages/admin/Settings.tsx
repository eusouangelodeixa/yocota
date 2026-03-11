import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, Upload, X } from "lucide-react";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export default function Settings() {
  const queryClient = useQueryClient();

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

  const [form, setForm] = useState({
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
      setForm({
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("site_settings")
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq("id", SETTINGS_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site_settings"] });
      toast.success("Configurações salvas!");
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

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
      setForm((f) => ({ ...f, logo_url: urlData.publicUrl }));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Personalização geral do seu negócio</p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all duration-150"
        >
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Identidade */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-sm font-semibold text-foreground">Identidade</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Nome e logo do seu negócio</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Nome do negócio</Label>
              <Input
                value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                placeholder="Meu Negócio"
                className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Logo</Label>
              {form.logo_url ? (
                <div className="relative w-28 h-28 border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden bg-[rgba(255,255,255,0.02)]">
                  <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  <button
                    onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
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
          </div>
        </div>

        {/* Padrões de Checkout */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <h3 className="text-sm font-semibold text-foreground">Padrões de Checkout</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Valores padrão para novos checkouts</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">URL de redirecionamento padrão</Label>
              <Input
                value={form.default_redirect_url}
                onChange={(e) => setForm((f) => ({ ...f, default_redirect_url: e.target.value }))}
                placeholder="https://suapagina.com/obrigado"
                className="h-10 bg-input border-[rgba(255,255,255,0.1)] rounded-lg focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Texto do botão (CTA)</Label>
              <Input
                value={form.default_cta_text}
                onChange={(e) => setForm((f) => ({ ...f, default_cta_text: e.target.value }))}
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
                      value={form[c.key]}
                      onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
                      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">{form[c.key]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
