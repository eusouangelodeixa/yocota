import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCentsToBRL } from "@/lib/formatters";
import { Plus, Pencil, Trash2, GitBranch, Copy, Code, ExternalLink, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OfferFunnelTree } from "@/components/OfferFunnelTree";

interface OfferForm {
  name: string;
  product_id: string;
  page_url: string;
  iframe_id: string;
  accept_next_offer_id: string;
  reject_next_offer_id: string;
}

const emptyForm: OfferForm = {
  name: "",
  product_id: "",
  page_url: "",
  iframe_id: "",
  accept_next_offer_id: "",
  reject_next_offer_id: "",
};

function EmbedCodeDialog({ offer }: { offer: any }) {
  const appUrl = window.location.origin;
  const iframeId = offer.iframe_id || "offer-iframe-" + offer.id.slice(0, 8);

  const embedCode = `<!-- Iframe de Oferta: ${offer.name} -->
<div id="offer-container-${iframeId}" style="width:100%;min-height:500px;">
  <iframe
    id="${iframeId}"
    style="width:100%;min-height:500px;border:none;border-radius:12px;"
    title="Oferta Especial"
    allow="payment"
    loading="lazy"
  ></iframe>
</div>

<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('offer_token');
  var iframe = document.getElementById('${iframeId}');
  var container = document.getElementById('offer-container-${iframeId}');

  if (token) {
    iframe.src = '${appUrl}/offer-frame/' + token;
  } else {
    container.style.display = 'none';
  }

  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'offer-complete') {
      var nextToken = event.data.nextToken;
      var nextPageUrl = event.data.nextPageUrl;
      if (nextPageUrl && nextToken) {
        window.location.href = nextPageUrl + (nextPageUrl.indexOf('?') > -1 ? '&' : '?') + 'offer_token=' + nextToken;
      } else if (nextToken) {
        iframe.src = '${appUrl}/offer-frame/' + nextToken;
      } else {
        container.innerHTML = '<div style="text-align:center;padding:40px;"><h3>Obrigado!</h3><p>Voce sera redirecionado em breve...</p></div>';
      }
    }
  });
})();
</script>`;

  const previewUrl = `${appUrl}/offer-frame/${offer.id}?preview=1`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    toast.success("Código copiado!");
  };

  const copyPreviewUrl = () => {
    navigator.clipboard.writeText(previewUrl);
    toast.success("URL de preview copiada!");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Código do iframe">
          <Code className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Código do Iframe — {offer.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cole este código na sua página de vendas externa onde o iframe da oferta deve aparecer.
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">🔍 Preview (testar visual)</Label>
            <div className="flex gap-2">
              <Input value={previewUrl} readOnly className="text-xs" />
              <Button variant="outline" size="sm" onClick={copyPreviewUrl}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-3 w-3" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Abra este link para ver como a oferta aparece no iframe. Botões desativados no preview.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">URL da página desta oferta</Label>
            <p className="text-xs text-muted-foreground">
              {offer.page_url ? (
                <span className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {offer.page_url}
                </span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400">
                  ⚠️ Nenhuma URL definida. Sem URL, a oferta será exibida inline na página de sucesso.
                </span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Código para colar na página</Label>
              <Button variant="outline" size="sm" onClick={copyEmbed}>
                <Copy className="mr-2 h-3 w-3" /> Copiar
              </Button>
            </div>
            <pre className="bg-muted text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
              {embedCode}
            </pre>
          </div>

          <div className="bg-accent/50 p-3 rounded-lg">
            <p className="text-xs text-foreground font-semibold mb-1">📋 Como funciona:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Após o pagamento, o sistema redireciona o cliente para a <strong>URL da Página</strong> com <code>?offer_token=TOKEN</code></li>
              <li>O script lê o token da URL e carrega o iframe com a oferta.</li>
              <li>Ao aceitar/recusar, o iframe redireciona automaticamente para a próxima oferta do funil.</li>
              <li>O pagamento do upsell é <strong>one-click</strong> (mesmo cartão).</li>
            </ol>
          </div>

          <div className="bg-muted/50 border border-border p-3 rounded-lg">
            <p className="text-xs text-foreground font-semibold mb-1">⚡ Teste rápido:</p>
            <p className="text-xs text-muted-foreground">
              Use o link de Preview acima para ver o visual. O iframe real só funciona com um token válido gerado após uma compra.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Offers() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: offers, isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*, products(name, price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (form: OfferForm) => {
      if (!form.product_id) throw new Error("Selecione um produto");
      if (!form.name.trim()) throw new Error("Nome é obrigatório");

      const payload = {
        name: form.name,
        product_id: form.product_id,
        page_url: form.page_url || null,
        iframe_id: form.iframe_id || null,
        accept_next_offer_id: form.accept_next_offer_id || null,
        reject_next_offer_id: form.reject_next_offer_id || null,
      };

      if (editingId) {
        const { error } = await supabase.from("offers").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("offers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Oferta atualizada!" : "Oferta criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Oferta excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (offer: any) => {
    setEditingId(offer.id);
    setForm({
      name: offer.name,
      product_id: offer.product_id,
      page_url: offer.page_url ?? "",
      iframe_id: offer.iframe_id ?? "",
      accept_next_offer_id: offer.accept_next_offer_id ?? "",
      reject_next_offer_id: offer.reject_next_offer_id ?? "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const getOfferName = (id: string | null) => {
    if (!id) return "—";
    const offer = offers?.find((o: any) => o.id === id);
    return offer?.name ?? "Desconhecida";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Ofertas</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all duration-150">
              <Plus className="mr-2 h-4 w-4" /> Nova Oferta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Oferta" : "Nova Oferta"}</DialogTitle>
              <p className="text-sm text-muted-foreground">Configure os detalhes da oferta de upsell/downsell.</p>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Upsell Premium"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatCentsToBRL(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-foreground">🌐 Página Externa (opcional)</p>
                <p className="text-xs text-muted-foreground">
                  Se preenchido, o cliente será redirecionado para esta URL após o pagamento. 
                  Nessa página, você cola o código do iframe (botão <Code className="inline h-3 w-3" /> na tabela).
                  Se vazio, a oferta aparece na nossa página de sucesso automaticamente.
                </p>
                <div className="space-y-2">
                  <Label className="text-xs">URL da Página</Label>
                  <Input
                    value={form.page_url}
                    onChange={(e) => setForm({ ...form, page_url: e.target.value })}
                    placeholder="https://suapagina.com/upsell-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">ID do Iframe</Label>
                  <Input
                    value={form.iframe_id}
                    onChange={(e) => setForm({ ...form, iframe_id: e.target.value })}
                    placeholder="offer-iframe"
                  />
                  <p className="text-xs text-muted-foreground">ID do elemento iframe na sua página. Padrão: "offer-iframe"</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Se aceitar → próxima oferta</Label>
                  <Select
                    value={form.accept_next_offer_id || "__none__"}
                    onValueChange={(v) => setForm({ ...form, accept_next_offer_id: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma (fim)</SelectItem>
                      {offers
                        ?.filter((o: any) => o.id !== editingId)
                        .map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Se recusar → próxima oferta</Label>
                  <Select
                    value={form.reject_next_offer_id || "__none__"}
                    onValueChange={(v) => setForm({ ...form, reject_next_offer_id: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma (fim)</SelectItem>
                      {offers
                        ?.filter((o: any) => o.id !== editingId)
                        .map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {offers && offers.filter((o: any) => o.id !== editingId).length === 0 && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  💡 Crie mais ofertas para poder encadear o funil (aceitar/recusar). Salve esta oferta primeiro.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-glass rounded-xl p-5">
          <h3 className="font-semibold text-sm text-foreground mb-3">📌 Como configurar o funil</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground mb-1">Modo 1: Página Externa (recomendado)</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Crie ofertas com <strong>URL da Página</strong> preenchida.</li>
                <li>Clique no botão <Code className="inline h-3 w-3" /> para copiar o código do iframe.</li>
                <li>Cole o código na sua página de vendas externa.</li>
                <li>No <strong>Checkout</strong>, selecione a primeira oferta.</li>
                <li>Após pagar, o cliente é redirecionado para sua página com o iframe.</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Modo 2: Página Inline (automático)</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Crie ofertas <strong>sem URL da Página</strong>.</li>
                <li>No <strong>Checkout</strong>, selecione a primeira oferta.</li>
                <li>Após pagar, o cliente vê as ofertas na nossa página de sucesso.</li>
                <li>Não precisa colar código em lugar nenhum.</li>
              </ol>
            </div>
          </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="funnel">
            <GitBranch className="mr-2 h-4 w-4" />
            Funil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="card-glass rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-[rgba(255,255,255,0.06)] hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs font-medium">Nome</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium">Produto</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium">Preço</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium">Modo</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium">Se Aceitar</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium">Se Recusar</TableHead>
                    <TableHead className="w-32 text-muted-foreground text-xs font-medium">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i} className="border-[rgba(255,255,255,0.04)]">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 w-20 shimmer rounded" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : offers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        Nenhuma oferta encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    offers?.map((offer: any) => (
                      <TableRow key={offer.id} className="border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-150">
                        <TableCell className="font-medium text-foreground">{offer.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{offer.products?.name}</TableCell>
                        <TableCell className="font-medium text-foreground">{formatCentsToBRL(offer.products?.price ?? 0)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border-0 ${
                            offer.page_url
                              ? "bg-[#3b82f618] text-[#60a5fa]"
                              : "bg-[rgba(255,255,255,0.06)] text-muted-foreground"
                          }`}>
                            {offer.page_url ? "Externa" : "Inline"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {getOfferName(offer.accept_next_offer_id)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {getOfferName(offer.reject_next_offer_id)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <EmbedCodeDialog offer={offer} />
                            <Button variant="ghost" size="icon" title="Preview" asChild>
                              <a href={`/offer-frame/${offer.id}?preview=1`} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(offer)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Excluir esta oferta?")) {
                                  deleteMutation.mutate(offer.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
          </div>
        </TabsContent>

        <TabsContent value="funnel">
          <OfferFunnelTree offers={offers ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
