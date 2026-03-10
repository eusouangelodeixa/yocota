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
import { Plus, Pencil, Trash2, GitBranch } from "lucide-react";
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Ofertas</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
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
              <div className="space-y-2">
                <Label>URL da Página (opcional)</Label>
                <Input
                  value={form.page_url}
                  onChange={(e) => setForm({ ...form, page_url: e.target.value })}
                  placeholder="https://exemplo.com/oferta"
                />
              </div>
              <div className="space-y-2">
                <Label>ID do Iframe (opcional)</Label>
                <Input
                  value={form.iframe_id}
                  onChange={(e) => setForm({ ...form, iframe_id: e.target.value })}
                  placeholder="iframe-upsell-1"
                />
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

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="funnel">
            <GitBranch className="mr-2 h-4 w-4" />
            Funil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Se Aceitar</TableHead>
                    <TableHead>Se Recusar</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : offers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma oferta encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    offers?.map((offer: any) => (
                      <TableRow key={offer.id}>
                        <TableCell className="font-medium">{offer.name}</TableCell>
                        <TableCell>{offer.products?.name}</TableCell>
                        <TableCell>{formatCentsToBRL(offer.products?.price ?? 0)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getOfferName(offer.accept_next_offer_id)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getOfferName(offer.reject_next_offer_id)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel">
          <OfferFunnelTree offers={offers ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
