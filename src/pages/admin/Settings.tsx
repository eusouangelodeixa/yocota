import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    default_primary_color: "#2563eb",
    default_accent_color: "#1e40af",
    default_bg_color: "#f8fafc",
    default_cta_text: "Finalizar compra",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name || "",
        logo_url: settings.logo_url || "",
        default_redirect_url: settings.default_redirect_url || "",
        default_primary_color: settings.default_primary_color || "#2563eb",
        default_accent_color: settings.default_accent_color || "#1e40af",
        default_bg_color: settings.default_bg_color || "#f8fafc",
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
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Personalização geral do seu negócio</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Identidade */}
        <Card>
          <CardHeader>
            <CardTitle>Identidade</CardTitle>
            <CardDescription>Nome e logo do seu negócio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do negócio</Label>
              <Input
                value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                placeholder="Meu Negócio"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {form.logo_url ? (
                <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                  <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  <button
                    onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                </label>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Padrões de Checkout */}
        <Card>
          <CardHeader>
            <CardTitle>Padrões de Checkout</CardTitle>
            <CardDescription>Valores padrão para novos checkouts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL de redirecionamento padrão</Label>
              <Input
                value={form.default_redirect_url}
                onChange={(e) => setForm((f) => ({ ...f, default_redirect_url: e.target.value }))}
                placeholder="https://suapagina.com/obrigado"
              />
            </div>
            <div className="space-y-2">
              <Label>Texto do botão (CTA)</Label>
              <Input
                value={form.default_cta_text}
                onChange={(e) => setForm((f) => ({ ...f, default_cta_text: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Cor primária</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.default_primary_color}
                    onChange={(e) => setForm((f) => ({ ...f, default_primary_color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <span className="text-xs text-muted-foreground">{form.default_primary_color}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cor de destaque</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.default_accent_color}
                    onChange={(e) => setForm((f) => ({ ...f, default_accent_color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <span className="text-xs text-muted-foreground">{form.default_accent_color}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cor de fundo</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.default_bg_color}
                    onChange={(e) => setForm((f) => ({ ...f, default_bg_color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <span className="text-xs text-muted-foreground">{form.default_bg_color}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
