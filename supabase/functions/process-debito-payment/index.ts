import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEBITO_API_URL = "https://my.debito.co.mz/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let step = "Inicialização de Variáveis";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
      throw new Error("Configuração do servidor incompleta.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load Débito config from api_keys table first, then fallback to env vars
    let debitoToken = "";
    let mpesaWalletId = "";
    let emolaWalletId = "";
    {
      const { data: keys } = await supabase.from("api_keys").select("key_name, key_value").in("key_name", ["DEBITO_API_TOKEN", "DEBITO_MPESA_WALLET_ID", "DEBITO_EMOLA_WALLET_ID"]);
      if (keys) {
        for (const k of keys) {
          if (k.key_name === "DEBITO_API_TOKEN") debitoToken = k.key_value;
          if (k.key_name === "DEBITO_MPESA_WALLET_ID") mpesaWalletId = k.key_value;
          if (k.key_name === "DEBITO_EMOLA_WALLET_ID") emolaWalletId = k.key_value;
        }
      }
    }
    if (!debitoToken) debitoToken = Deno.env.get("DEBITO_API_TOKEN") || "";
    if (!mpesaWalletId) mpesaWalletId = Deno.env.get("DEBITO_MPESA_WALLET_ID") || "616644";
    if (!emolaWalletId) emolaWalletId = Deno.env.get("DEBITO_EMOLA_WALLET_ID") || "217265";

    const params = await req.json();
    const { action } = params;

    console.log(`Iniciando ação: ${action}`);

    if (action === "initiate") {
      const { checkout_id, customer_name, customer_email, customer_phone, wallet_type, msisdn, selected_bump_ids, utm_data } = params;

      step = "Busca de Checkout/Produto";
      console.log(`Buscando checkout: ${checkout_id}`);
      const { data: checkout, error: chkError } = await supabase.from("checkouts").select("*").eq("id", checkout_id).maybeSingle();
      if (chkError || !checkout) throw new Error("Checkout não encontrado ou erro na busca.");

      const { data: mainProduct, error: prdError } = await supabase.from("products").select("*").eq("id", checkout.product_id).maybeSingle();
      if (prdError || !mainProduct) throw new Error("Produto principal não encontrado.");

      step = "Cálculo de Preço";
      let totalAmountCents = mainProduct.price || 0;
      if (selected_bump_ids?.length > 0) {
        const { data: bumps } = await supabase.from("products").select("price").in("id", selected_bump_ids);
        bumps?.forEach(b => totalAmountCents += (b.price || 0));
      }

      const finalAmount = totalAmountCents / 100;
      const wallet_id = wallet_type === "mpesa" ? mpesaWalletId : emolaWalletId;
      const uniqueRef = `YCT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      step = "Chamada API Débito";
      console.log(`Enviando para Débito: ${wallet_type}, Valor: ${finalAmount}`);
      
      const payload = {
        msisdn: msisdn.replace(/\D/g, ""),
        amount: finalAmount,
        reference_description: `Ped: ${uniqueRef}`.substring(0, 32)
      };

      const endpoint = `${DEBITO_API_URL}/wallets/${wallet_id}/c2b/${wallet_type}`;
      console.log(`Endpoint: ${endpoint}, Token: ${debitoToken ? debitoToken.substring(0, 8) + '...' : 'EMPTY'}`);
      const debitoRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Bearer ${debitoToken}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await debitoRes.text();
      let debitoData: any;
      try {
        debitoData = JSON.parse(responseText);
      } catch {
        console.error("Débito API returned non-JSON:", responseText.substring(0, 200));
        throw new Error(`Erro de comunicação com a API de pagamento (HTTP ${debitoRes.status})`);
      }
      if (!debitoRes.ok) {
        console.error("Erro na API Débito:", debitoData);
        throw new Error(debitoData.message || `Erro ${debitoRes.status} na Débito`);
      }

      step = "Salvando Dados no Supabase (Customer)";
      const { data: customer, error: custError } = await supabase.from("customers").upsert({
        email: customer_email.toLowerCase(), 
        name: customer_name, 
        phone: customer_phone,
        last_wallet_number: msisdn.replace(/\D/g, ""),
        last_wallet_type: wallet_type
      }, { onConflict: 'email' }).select().single();
      if (custError || !customer) throw new Error("Falha ao salvar/encontrar cliente.");

      step = "Salvando Dados no Supabase (Order)";
      const { data: order, error: ordError } = await supabase.from("orders").insert({
        checkout_id: checkout.id, customer_id: customer.id, total_amount: totalAmountCents, currency: "MZN", status: "pending", 
        debito_reference: debitoData.debito_reference, provider_order_id: uniqueRef, payment_provider: "debito",
        selected_bumps: selected_bump_ids || [], // Guardando para processar após o pagamento
        utm_source: utm_data?.utm_source, utm_medium: utm_data?.utm_medium, utm_campaign: utm_data?.utm_campaign
      }).select().single();
      if (ordError || !order) throw new Error("Falha ao criar pedido no banco.");

      console.log(`Sucesso! Pedido ID: ${order.id}, Ref Débito: ${debitoData.debito_reference}`);
      return new Response(JSON.stringify({ success: true, debito_reference: debitoData.debito_reference, order_id: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });

    } else if (action === "status") {
      const { debito_reference } = params;
      const statusRes = await fetch(`${DEBITO_API_URL}/transactions/${debito_reference}/status`, {
        headers: { "Authorization": `Bearer ${debitoToken}`, "Accept": "application/json" },
      });
      const statusText = await statusRes.text();
      let statusData: any;
      try {
        statusData = JSON.parse(statusText);
      } catch {
        console.error("Débito status API returned non-JSON:", statusText.substring(0, 200));
        throw new Error(`Erro de comunicação com a API de pagamento (HTTP ${statusRes.status})`);
      }
      const currentStatus = (statusData.status || "").toUpperCase();
      
      if (["SUCCESS", "PAID", "COMPLETED"].includes(currentStatus)) {
        statusData.status = "SUCCESS"; // Normaliza para o frontend
        // 1. Busca o pedido para processar itens e entregas
        const { data: order } = await supabase.from("orders")
          .select("*, checkouts(product_id)")
          .eq("debito_reference", debito_reference)
          .maybeSingle();

        if (order && order.status !== "paid") {
          console.log("Processando Sucesso de Checkout Principal:", order.id);

          // Atualiza status do pedido para pago
          await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);

          // Guard against duplicate processing: check if order_items already exist
          const { data: existingItems } = await supabase.from("order_items").select("id").eq("order_id", order.id).limit(1);
          if (existingItems && existingItems.length > 0) {
            console.log("Order items already exist for order:", order.id, "— skipping duplicate processing");
          } else {
            // Lista de itens a processar para entrega
            const productsToRegister: { id: string; type: "main" | "bump" | "upsell" }[] = [
              { id: order.checkouts.product_id, type: "main" }
            ];

            // Adiciona os Bumps à lista de registo
            const selectedBumps = order.selected_bumps as string[];
            if (selectedBumps && selectedBumps.length > 0) {
              selectedBumps.forEach(bumpId => productsToRegister.push({ id: bumpId, type: "bump" }));
            }

            // Regista cada item e dispara entrega
            for (const item of productsToRegister) {
              const { data: newItem } = await supabase.from("order_items").insert({
                order_id: order.id,
                product_id: item.id,
                amount: 0, // O valor já foi capturado no total_amount da order
                type: item.type
              }).select().single();

              if (newItem) {
                try {
                  const deliveryUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`;
                  await fetch(deliveryUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    },
                    body: JSON.stringify({ order_id: order.id, order_item_id: newItem.id }),
                  });
                } catch (e) {
                  console.warn(`Falha ao disparar entrega para item ${newItem.id}:`, e);
                }
              }
            }
          }
        }
        
        // 2. Verifica se é uma referência de Upsell (Lógica já robusta)
        const { data: upsellSession } = await supabase
          .from("offer_sessions")
          .select("*, offers(*, products(*))")
          .eq("debito_reference", debito_reference)
          .is("decision", null)
          .maybeSingle();

        if (upsellSession) {
          console.log("Processando Sucesso de Upsell:", upsellSession.id);
          const product = upsellSession.offers.products;

          const { data: upsellItem } = await supabase.from("order_items").insert({
            order_id: upsellSession.order_id,
            product_id: product.id,
            amount: product.price,
            type: "upsell"
          }).select().single();

          const { data: orderData } = await supabase.from("orders").select("total_amount").eq("id", upsellSession.order_id).single();
          if (orderData) {
            await supabase.from("orders").update({ total_amount: orderData.total_amount + product.price }).eq("id", upsellSession.order_id);
          }

          await supabase.from("offer_sessions").update({ 
            decision: "accepted", 
            decided_at: new Date().toISOString() 
          }).eq("id", upsellSession.id);

          if (upsellItem) {
            try {
              const deliveryUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`;
              await fetch(deliveryUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ order_id: upsellSession.order_id, order_item_id: upsellItem.id }),
              });
            } catch (e) {
              console.warn("Falha ao disparar entrega do Upsell:", e);
            }
          }
        }
      }
      return new Response(JSON.stringify(statusData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Ação inválida");

  } catch (error) {
    console.error(`ERRO no Passo [${step}]:`, error.message);
    return new Response(JSON.stringify({ success: false, error: error.message, step }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200, // Retornamos 200 para capturar o erro no JSON do frontend
    });
  }
});
