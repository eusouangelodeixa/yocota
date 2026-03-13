import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RotateCcw, Save, Palette, Type, Layout } from "lucide-react";
import { formatCents } from "@/lib/formatters";

export interface PopupStyle {
  // Texts
  title: string;
  subtitle: string;
  description: string;
  accept_button_text: string;
  reject_button_text: string;
  charge_info_text: string;
  // Colors
  popup_bg_color: string;
  overlay_bg_color: string;
  accept_button_color: string;
  accept_button_text_color: string;
  reject_button_color: string;
  reject_text_color: string;
  title_color: string;
  subtitle_color: string;
  description_color: string;
  price_color: string;
  charge_info_color: string;
  border_color: string;
  // Layout
  padding: string;
  border_radius: string;
  button_height: string;
  text_align: string;
}

export const defaultPopupStyle: PopupStyle = {
  title: "",
  subtitle: "",
  description: "",
  accept_button_text: "Sim, quero!",
  reject_button_text: "Não, obrigado",
  charge_info_text: "Cobrança automática no mesmo cartão",
  popup_bg_color: "#FFFFFF",
  overlay_bg_color: "rgba(0,0,0,0.5)",
  accept_button_color: "#E04B00",
  accept_button_text_color: "#FFFFFF",
  reject_button_color: "transparent",
  reject_text_color: "#888888",
  title_color: "#111111",
  subtitle_color: "#555555",
  description_color: "#555555",
  price_color: "#111111",
  charge_info_color: "#888888",
  border_color: "",
  padding: "32",
  border_radius: "12",
  button_height: "48",
  text_align: "center",
};

interface Props {
  offer: any;
  onClose: () => void;
}

export function OfferPopupEditor({ offer, onClose }: Props) {
  const queryClient = useQueryClient();
  const product = offer.products;

  const [style, setStyle] = useState<PopupStyle>(() => {
    const saved = offer.popup_style as Record<string, any> | null;
    return { ...defaultPopupStyle, ...(saved || {}) };
  });

  const update = (key: keyof PopupStyle, value: string) => setStyle((prev) => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("offers").update({ popup_style: style as any }).eq("id", offer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Estilo do popup salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetToDefaults = () => {
    setStyle({ ...defaultPopupStyle });
    toast.info("Valores restaurados para padrão");
  };

  const displayTitle = style.title || product?.name || "Nome do Produto";
  const displaySubtitle = style.subtitle;
  const displayDescription = style.description || product?.description || "";

  const ColorField = ({ label, propKey }: { label: string; propKey: keyof PopupStyle }) => (
    <div className="flex items-center gap-2">
      <input type="color" value={style[propKey] || "#000000"} onChange={(e) => update(propKey, e.target.value)} className="w-8 h-8 rounded border border-border cursor-pointer shrink-0" />
      <div className="flex-1 min-w-0">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <Input value={style[propKey]} onChange={(e) => update(propKey, e.target.value)} className="h-8 text-xs mt-0.5" />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[80vh]">
      {/* Editor Panel */}
      <div className="overflow-y-auto pr-2 space-y-4 max-h-[75vh]">
        <Tabs defaultValue="content">
          <TabsList className="bg-secondary border border-border w-full">
            <TabsTrigger value="content" className="text-xs flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Type className="mr-1 h-3 w-3" strokeWidth={1.5} />Conteúdo
            </TabsTrigger>
            <TabsTrigger value="style" className="text-xs flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Palette className="mr-1 h-3 w-3" strokeWidth={1.5} />Estilo
            </TabsTrigger>
            <TabsTrigger value="layout" className="text-xs flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Layout className="mr-1 h-3 w-3" strokeWidth={1.5} />Layout
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Título (vazio = nome do produto)</Label>
              <Input value={style.title} onChange={(e) => update("title", e.target.value)} placeholder={product?.name || "Nome do produto"} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subtítulo</Label>
              <Input value={style.subtitle} onChange={(e) => update("subtitle", e.target.value)} placeholder="Ex: Oferta exclusiva para você" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Descrição (vazio = descrição do produto)</Label>
              <Textarea value={style.description} onChange={(e) => update("description", e.target.value)} placeholder={product?.description || ""} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Texto do botão de compra</Label>
              <Input value={style.accept_button_text} onChange={(e) => update("accept_button_text", e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Texto do botão de recusa</Label>
              <Input value={style.reject_button_text} onChange={(e) => update("reject_button_text", e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Texto informativo da cobrança</Label>
              <Input value={style.charge_info_text} onChange={(e) => update("charge_info_text", e.target.value)} className="h-9" />
            </div>
          </TabsContent>

          <TabsContent value="style" className="space-y-3 mt-3">
            <p className="text-[11px] font-medium text-foreground uppercase tracking-wider">Popup</p>
            <ColorField label="Background do popup" propKey="popup_bg_color" />
            <ColorField label="Overlay da página" propKey="overlay_bg_color" />
            <ColorField label="Borda do popup (vazio = sem borda)" propKey="border_color" />

            <p className="text-[11px] font-medium text-foreground uppercase tracking-wider mt-4">Textos</p>
            <ColorField label="Cor do título" propKey="title_color" />
            <ColorField label="Cor do subtítulo" propKey="subtitle_color" />
            <ColorField label="Cor da descrição" propKey="description_color" />
            <ColorField label="Cor do preço" propKey="price_color" />
            <ColorField label="Cor info cobrança" propKey="charge_info_color" />

            <p className="text-[11px] font-medium text-foreground uppercase tracking-wider mt-4">Botões</p>
            <ColorField label="Cor do botão de compra" propKey="accept_button_color" />
            <ColorField label="Cor do texto do botão" propKey="accept_button_text_color" />
            <ColorField label="Cor do botão de recusa" propKey="reject_button_color" />
            <ColorField label="Cor do texto de recusa" propKey="reject_text_color" />
          </TabsContent>

          <TabsContent value="layout" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Padding interno (px)</Label>
              <Input type="number" value={style.padding} onChange={(e) => update("padding", e.target.value)} className="h-9" min="8" max="64" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Arredondamento das bordas (px)</Label>
              <Input type="number" value={style.border_radius} onChange={(e) => update("border_radius", e.target.value)} className="h-9" min="0" max="32" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Altura do botão (px)</Label>
              <Input type="number" value={style.button_height} onChange={(e) => update("button_height", e.target.value)} className="h-9" min="36" max="64" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Alinhamento de textos</Label>
              <Select value={style.text_align} onValueChange={(v) => update("text_align", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" className="h-9 text-xs border-border" onClick={resetToDefaults}>
            <RotateCcw className="mr-1.5 h-3 w-3" strokeWidth={1.5} />Restaurar padrão
          </Button>
          <Button className="flex-1 h-9 bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 active:scale-[0.98]" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-1.5 h-3 w-3" strokeWidth={1.5} />{saveMutation.isPending ? "Salvando..." : "Salvar estilo"}
          </Button>
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="flex flex-col">
        <p className="text-[11px] font-medium text-foreground uppercase tracking-wider mb-3">Preview em tempo real</p>
        <div
          className="flex-1 flex items-center justify-center rounded-lg min-h-[400px] overflow-hidden"
          style={{ backgroundColor: style.overlay_bg_color || "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-sm space-y-5"
            style={{
              backgroundColor: style.popup_bg_color,
              padding: `${style.padding}px`,
              borderRadius: `${style.border_radius}px`,
              border: style.border_color ? `1px solid ${style.border_color}` : "none",
              textAlign: style.text_align as any,
            }}
          >
            {displaySubtitle && (
              <p className="text-sm font-medium" style={{ color: style.subtitle_color }}>{displaySubtitle}</p>
            )}
            <h2 className="text-lg font-semibold" style={{ color: style.title_color }}>{displayTitle}</h2>
            {displayDescription && (
              <p className="text-sm leading-relaxed" style={{ color: style.description_color }}>{displayDescription}</p>
            )}
            <div style={{ borderTop: `1px solid ${style.border_color || '#e5e7eb'}` }} />
            <div className="text-[32px] font-bold tabular-nums" style={{ color: style.price_color }}>
              {formatCents(product?.price ?? 0, product?.currency ?? "brl")}
            </div>
            <p className="text-[11px]" style={{ color: style.charge_info_color }}>{style.charge_info_text}</p>
            <div className="space-y-3 pt-1">
              <button
                className="w-full font-bold text-sm transition-all duration-150"
                style={{
                  height: `${style.button_height}px`,
                  backgroundColor: style.accept_button_color,
                  color: style.accept_button_text_color,
                  borderRadius: `${Math.min(Number(style.border_radius), 12)}px`,
                  border: "none",
                  cursor: "default",
                }}
              >
                {style.accept_button_text}
              </button>
              <button
                className="w-full text-sm transition-colors duration-150"
                style={{
                  backgroundColor: style.reject_button_color,
                  color: style.reject_text_color,
                  border: "none",
                  cursor: "default",
                  padding: "8px",
                }}
              >
                {style.reject_button_text}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
