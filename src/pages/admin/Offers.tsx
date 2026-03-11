import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCents } from "@/lib/formatters";
import { Plus, Pencil, Trash2, GitBranch, Copy, Code, ExternalLink, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OfferFunnelTree } from "@/components/OfferFunnelTree";

interface OfferForm { name: string; product_id: string; page_url: string; iframe_id: string; accept_next_offer_id: string; reject_next_offer_id: string; }
const emptyForm: OfferForm = { name: "", product_id: "", page_url: "", iframe_id: "", accept_next_offer_id: "", reject_next_offer_id: "" };

function EmbedCodeDialog({ offer }: { offer: any }) {
  const appUrl = window.location.origin;
  const iframeId = offer.iframe_id || "offer-iframe-" + offer.id.slice(0, 8);
  const embedCode = `<!-- Iframe de Oferta: ${offer.name} -->\n<div id="offer-container-${iframeId}" style="width:100%;min-height:500px;">\n  <iframe id="${iframeId}" style="width:100%;min-height:500px;border:none;" title="Oferta Especial" allow="payment" loading="lazy"></iframe>\n</div>\n<script>\n(function() {\n  var params = new URLSearchParams(window.location.search);\n  var token = params.get('offer_token');\n  var iframe = document.getElementById('${iframeId}');\n  var container = document.getElementById('offer-container-${iframeId}');\n  if (token) { iframe.src = '${appUrl}/offer-frame/' + token; } else { container.style.display = 'none'; }\n  window.addEventListener('message', function(event) {\n    if (event.data && event.data.type === 'offer-complete') {\n      var nextToken = event.data.nextToken;\n      var nextPageUrl = event.data.nextPageUrl;\n      if (nextPageUrl && nextToken) { window.location.href = nextPageUrl + (nextPageUrl.indexOf('?') > -1 ? '&' : '?') + 'offer_token=' + nextToken; }\n      else if (nextToken) { iframe.src = '${appUrl}/offer-frame/' + nextToken; }\n      else { container.innerHTML = '<div style="text-align:center;padding:40px;"><h3>Obrigado!</h3></div>'; }\n    }\n  });\n})();\n</script>`;
  const previewUrl = `${appUrl}/offer-frame/${offer.id}?preview=1`;
  const copyEmbed = () => { navigator.clipboard.writeText(embedCode); toast.success("Código copiado!"); };
  const copyPreviewUrl = () => { navigator.clipboard.writeText(previewUrl); toast.success("URL de preview copiada!"); };

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Código do iframe" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Code className="h-3.5 w-3.5" strokeWidth={1.5} /></Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Código do Iframe — {offer.name}</DialogTitle>
          <p className="text-[13px] text-muted-foreground">Cole este código na sua página de vendas externa.</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preview (testar visual)</Label>
            <div className="flex gap-2">
              <Input value={previewUrl} readOnly className="text-xs" />
              <Button variant="outline" size="sm" className="h-9 border-border" onClick={copyPreviewUrl}><Copy className="h-3 w-3" strokeWidth={1.5} /></Button>
              <Button variant="outline" size="sm" className="h-9 border-border" asChild><a href={previewUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-3 w-3" strokeWidth={1.5} /></a></Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">URL da página desta oferta</Label>
            <p className="text-[11px] text-muted-foreground">
              {offer.page_url ? (<span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" strokeWidth={1.5} />{offer.page_url}</span>) : (<span className="text-[#f59e0b]">⚠️ Nenhuma URL definida. Oferta será exibida inline.</span>)}
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Código para colar na página</Label>
              <Button variant="outline" size="sm" className="h-8 border-border text-xs" onClick={copyEmbed}><Copy className="mr-1.5 h-3 w-3" strokeWidth={1.5} /> Copiar</Button>
            </div>
            <pre className="bg-input text-[11px] p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto text-muted-foreground border border-border">{embedCode}</pre>
          </div>
          <div className="bg-secondary p-3 rounded-lg">
            <p className="text-[11px] text-foreground font-medium mb-1">Como funciona:</p>
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Após o pagamento, redireciona para a URL da Página com <code className="text-foreground">?offer_token=TOKEN</code></li>
              <li>O script lê o token e carrega o iframe.</li>
              <li>Ao aceitar/recusar, redireciona automaticamente.</li>
              <li>Pagamento do upsell é one-click.</li>
            </ol>
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
    queryFn: async () => { const { data, error } = await supabase.from("products").select("id, name, price").eq("active", true).order("name"); if (error) throw error; return data; },
  });

  const { data: offers, isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: async () => { const { data, error } = await supabase.from("offers").select("*, products(name, price)").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const saveMutation = useMutation({
    mutationFn: async (form: OfferForm) => {
      if (!form.product_id) throw new Error("Selecione um produto");
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const payload = { name: form.name, product_id: form.product_id, page_url: form.page_url || null, iframe_id: form.iframe_id || null, accept_next_offer_id: form.accept_next_offer_id || null, reject_next_offer_id: form.reject_next_offer_id || null };
      if (editingId) { const { error } = await supabase.from("offers").update(payload).eq("id", editingId); if (error) throw error; }
      else { const { error } = await supabase.from("offers").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["offers"] }); setDialogOpen(false); setEditingId(null); setForm(emptyForm); toast.success(editingId ? "Oferta atualizada!" : "Oferta criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("offers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["offers"] }); toast.success("Oferta excluída!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (offer: any) => { setEditingId(offer.id); setForm({ name: offer.name, product_id: offer.product_id, page_url: offer.page_url ?? "", iframe_id: offer.iframe_id ?? "", accept_next_offer_id: offer.accept_next_offer_id ?? "", reject_next_offer_id: offer.reject_next_offer_id ?? "" }); setDialogOpen(true); };
  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const getOfferName = (id: string | null) => { if (!id) return "—"; return offers?.find((o: any) => o.id === id)?.name ?? "Desconhecida"; };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Ofertas</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="h-9 bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 active:scale-[0.98] transition-all duration-150">
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} /> Nova Oferta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">{editingId ? "Editar Oferta" : "Nova Oferta"}</DialogTitle>
              <p className="text-[13px] text-muted-foreground">Configure os detalhes da oferta de upsell/downsell.</p>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Upsell Premium" required /></div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Produto</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} — {formatCents(p.price)}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="bg-input p-3 rounded-lg space-y-3 border border-border">
                <p className="text-[11px] font-medium text-foreground uppercase tracking-wider">Página Externa (opcional)</p>
                <p className="text-[11px] text-muted-foreground">Se preenchido, o cliente será redirecionado para esta URL. Se vazio, a oferta aparece na nossa página de sucesso.</p>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">URL da Página</Label><Input value={form.page_url} onChange={(e) => setForm({ ...form, page_url: e.target.value })} placeholder="https://suapagina.com/upsell-1" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">ID do Iframe</Label><Input value={form.iframe_id} onChange={(e) => setForm({ ...form, iframe_id: e.target.value })} placeholder="offer-iframe" /><p className="text-[10px] text-muted-foreground">Padrão: "offer-iframe"</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Se aceitar → próxima</Label>
                  <Select value={form.accept_next_offer_id || "__none__"} onValueChange={(v) => setForm({ ...form, accept_next_offer_id: v === "__none__" ? "" : v })}><SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger><SelectContent><SelectItem value="__none__">Nenhuma (fim)</SelectItem>{offers?.filter((o: any) => o.id !== editingId).map((o: any) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}</SelectContent></Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Se recusar → próxima</Label>
                  <Select value={form.reject_next_offer_id || "__none__"} onValueChange={(v) => setForm({ ...form, reject_next_offer_id: v === "__none__" ? "" : v })}><SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger><SelectContent><SelectItem value="__none__">Nenhuma (fim)</SelectItem>{offers?.filter((o: any) => o.id !== editingId).map((o: any) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}</SelectContent></Select>
                </div>
              </div>
              <Button type="submit" className="w-full h-10 bg-primary text-primary-foreground font-bold hover:brightness-110 active:scale-[0.98]" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-surface rounded-[10px] p-5">
        <h3 className="text-sm font-medium text-foreground mb-3">Como configurar o funil</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-muted-foreground">
          <div><p className="font-medium text-foreground mb-1">Modo 1: Página Externa</p><ol className="space-y-1 list-decimal list-inside"><li>Crie ofertas com URL da Página preenchida.</li><li>Copie o código do iframe.</li><li>Cole na sua página de vendas.</li><li>No Checkout, selecione a primeira oferta.</li></ol></div>
          <div><p className="font-medium text-foreground mb-1">Modo 2: Página Inline</p><ol className="space-y-1 list-decimal list-inside"><li>Crie ofertas sem URL da Página.</li><li>No Checkout, selecione a primeira oferta.</li><li>Após pagar, o cliente vê as ofertas na nossa página de sucesso.</li></ol></div>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="list" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Lista</TabsTrigger>
          <TabsTrigger value="funnel" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><GitBranch className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />Funil</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="card-surface rounded-[10px] overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-input">
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Nome</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Produto</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Preço</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Modo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Se Aceitar</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Se Recusar</TableHead>
                  <TableHead className="w-32 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (<TableRow key={i} className="border-border">{Array.from({ length: 7 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-20 shimmer rounded" /></TableCell>))}</TableRow>))
                ) : offers?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-[13px]">Nenhuma oferta encontrada</TableCell></TableRow>
                ) : (
                  offers?.map((offer: any) => (
                    <TableRow key={offer.id} className="border-border hover:bg-[rgba(255,255,255,0.02)] h-12">
                      <TableCell className="text-[13px] font-medium text-foreground">{offer.name}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{offer.products?.name}</TableCell>
                      <TableCell className="text-[13px] font-medium text-foreground tabular-nums">{formatCents(offer.products?.price ?? 0)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${offer.page_url ? "pill-sent" : "text-muted-foreground bg-secondary"}`}>
                          {offer.page_url ? "Externa" : "Inline"}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{getOfferName(offer.accept_next_offer_id)}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{getOfferName(offer.reject_next_offer_id)}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <EmbedCodeDialog offer={offer} />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Preview" asChild><a href={`/offer-frame/${offer.id}?preview=1`} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" strokeWidth={1.5} /></a></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(offer)}><Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("Excluir esta oferta?")) deleteMutation.mutate(offer.id); }}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>
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
