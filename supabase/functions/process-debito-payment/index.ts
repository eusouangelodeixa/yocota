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
    if (!mpesaWalletId) mpesaWalletId = Deno.env.get("DEBITO_MPESA_WALLET_ID") || "376544";
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

      // Handle optional email — store null when empty to avoid unique constraint conflicts
      const emailToStore = customer_email?.trim() ? customer_email.trim().toLowerCase() : null;

      let customer: any = null;
      let custError: any = null;

      if (emailToStore) {
        // Has email — upsert by email (update name/phone if already exists)
        const result = await supabase.from("customers").upsert({
          email: emailToStore, name: customer_name, phone: customer_phone,
          last_wallet_number: msisdn.replace(/\D/g, ""), last_wallet_type: wallet_type
        }, { onConflict: 'email' }).select().single();
        customer = result.data; custError = result.error;
      } else {
        // No email — lookup by phone first to avoid duplicate records
        const { data: byPhone } = await supabase.from("customers").select("*").eq("phone", customer_phone).maybeSingle();
        if (byPhone) {
          await supabase.from("customers").update({
            name: customer_name,
            last_wallet_number: msisdn.replace(/\D/g, ""), last_wallet_type: wallet_type
          }).eq("id", byPhone.id);
          customer = { ...byPhone, name: customer_name };
        } else {
          const result = await supabase.from("customers").insert({
            email: null, name: customer_name, phone: customer_phone,
            last_wallet_number: msisdn.replace(/\D/g, ""), last_wallet_type: wallet_type
          }).select().single();
          customer = result.data; custError = result.error;
        }
      }
      if (custError || !customer) throw new Error("Falha ao salvar/encontrar cliente.");

      // 2. Create Order FIRST with pending status (before API call)
      step = "Salvando Dados no Supabase (Order)";
      const { data: order, error: ordError } = await supabase.from("orders").insert({
        checkout_id: checkout.id, customer_id: customer.id, total_amount: totalAmountCents, currency: "MZN", status: "pending", 
        debito_reference: null, provider_order_id: uniqueRef, payment_provider: "debito",
        wallet_type: wallet_type || null,
        selected_bumps: selected_bump_ids || [],
        utm_source: utm_data?.utm_source, utm_medium: utm_data?.utm_medium, utm_campaign: utm_data?.utm_campaign
      }).select().single();
      if (ordError || !order) throw new Error("Falha ao criar pedido no banco.");
      console.log(`Pedido criado: ${order.id}, Ref: ${uniqueRef}`);
      
      // 3. Call Débito API — Await fully to respect synchronous behavior
      // The M-Pesa C2B API is synchronous and holds the connection until the user enters the PIN.
      // Deno Deploy kills background processes if we return early, so we MUST await it.
      // The frontend already shows the "pending" modal before making this request.
      step = "Chamada API Débito";
      console.log(`Enviando para Débito: ${wallet_type}, Valor: ${finalAmount}`);
      
      const payload = {
        msisdn: msisdn.replace(/\D/g, ""),
        amount: finalAmount,
        reference_description: `Ped: ${uniqueRef}`.substring(0, 32)
      };

      const endpoint = `${DEBITO_API_URL}/wallets/${wallet_id}/c2b/${wallet_type}`;
      console.log(`Endpoint: ${endpoint}, Token: ${debitoToken ? debitoToken.substring(0, 8) + '...' : 'EMPTY'}`);
      
      try {
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
          // If we receive a 504 Gateway Timeout HTML page, it means the user took too long to put the PIN.
          if (!debitoRes.ok || debitoRes.status === 504) {
            throw new Error(`Timeout ou erro de comunicação com a API de pagamento (HTTP ${debitoRes.status}) - Provavelmente o tempo limite para inserir o PIN expirou.`);
          }
          throw new Error(`Resposta inválida da API de pagamento (HTTP ${debitoRes.status})`);
        }

        if (!debitoRes.ok) {
          console.error("Erro na API Débito:", debitoData);
          await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
          throw new Error(debitoData.message || `Erro ${debitoRes.status} na Débito`);
        }

        // Successfully received the response from Débito!
        // M-Pesa usually responds with SUCCESSFUL if paid directly, eMola responds with PROCESSING.
        const currentStatus = (debitoData.status || "").toUpperCase();
        console.log(`Debito API respondeu com status: ${currentStatus}`);

        const finalDebitoRef = debitoData.debito_reference || debitoData.reference || uniqueRef;
        const updatePayload: any = { debito_reference: finalDebitoRef, provider_order_id: finalDebitoRef };
        if (["SUCCESS", "PAID", "COMPLETED", "SUCCESSFUL"].includes(currentStatus)) {
          updatePayload.status = "paid";
        }
        
        // Update order with Débito reference and status
        await supabase.from("orders").update(updatePayload).eq("id", order.id);

        // If paid immediately — create order_items and trigger deliveries NOW
        // (the webhook checks order_items.length > 0 before delivering, so items MUST exist)
        if (updatePayload.status === "paid") {
          const productsToDeliver: { id: string; price: number; type: string }[] = [
            { id: mainProduct.id, price: mainProduct.price, type: "main" }
          ];
          if (selected_bump_ids?.length > 0) {
            const { data: bumpProds } = await supabase.from("products").select("id, price").in("id", selected_bump_ids);
            bumpProds?.forEach(b => productsToDeliver.push({ id: b.id, price: b.price, type: "bump" }));
          }
          for (const prod of productsToDeliver) {
            const { data: newItem } = await supabase.from("order_items").insert({
              order_id: order.id, product_id: prod.id, amount: prod.price, type: prod.type
            }).select("id").single();
            if (newItem) {
              try {
                await fetch(`${supabaseUrl}/functions/v1/delivery-send`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
                  body: JSON.stringify({ order_id: order.id, order_item_id: newItem.id }),
                });
                console.log(`Delivery triggered for item ${newItem.id}`);
              } catch (e) { console.warn(`Falha ao acionar entrega item ${newItem.id}:`, e); }
            }
          }

          // Create offer session if needed
          if (checkout.first_offer_id) {
            const { data: existingOffer } = await supabase.from("offer_sessions").select("id").eq("order_id", order.id).maybeSingle();
            if (!existingOffer) {
              await supabase.from("offer_sessions").insert({ offer_id: checkout.first_offer_id, order_id: order.id, customer_id: customer.id, debito_reference: finalDebitoRef });
            }
          }
        } else if (checkout.first_offer_id) {
          // Not yet paid (PROCESSING) — create offer session if checkout has one, will activate via webhook later
          const { data: existingOffer } = await supabase.from("offer_sessions").select("id").eq("order_id", order.id).maybeSingle();
          if (!existingOffer) {
            await supabase.from("offer_sessions").insert({ offer_id: checkout.first_offer_id, order_id: order.id, customer_id: customer.id, debito_reference: finalDebitoRef });
          }
        }

        console.log(`Sucesso! Pedido ID: ${order.id}, Ref Débito: ${finalDebitoRef}`);
        
        return new Response(JSON.stringify({ 
          success: true, 
          debito_reference: finalDebitoRef, 
          order_id: order.id,
          status: updatePayload.status === "paid" ? "SUCCESS" : "PENDING"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });

      } catch (fetchErr: any) {
        // Here we catch network errors or our manual non-JSON timeout throw
        console.error("Erro real na chamada Débito:", fetchErr.message);
        await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
        throw fetchErr;
      }

    } else if (action === "status") {
      const { debito_reference } = params;
      
      // 1. Always check database first — webhook may have already updated the order
      const { data: dbOrder } = await supabase.from("orders")
        .select("*, checkouts(product_id, first_offer_id)")
        .or(`debito_reference.eq.${debito_reference},provider_order_id.eq.${debito_reference}`)
        .maybeSingle();
      
      // If order is already paid in DB (via webhook), process deliveries and return SUCCESS
      if (dbOrder?.status === "paid") {
        console.log("Order já pago no DB (via webhook):", dbOrder.id);
        
        // Ensure offer session exists if applicable
        if (dbOrder.checkouts?.first_offer_id && dbOrder.customer_id) {
          const { data: existingOffer } = await supabase.from("offer_sessions").select("id").eq("order_id", dbOrder.id).maybeSingle();
          if (!existingOffer) {
            await supabase.from("offer_sessions").insert({ offer_id: dbOrder.checkouts.first_offer_id, order_id: dbOrder.id, customer_id: dbOrder.customer_id, debito_reference });
          }
        }

        // Process deliveries if not yet done
        const { data: existingItems } = await supabase.from("order_items").select("id").eq("order_id", dbOrder.id).limit(1);
        if (!existingItems || existingItems.length === 0) {
          const productsToRegister: { id: string; type: "main" | "bump" | "upsell" }[] = [
            { id: dbOrder.checkouts.product_id, type: "main" }
          ];
          const selectedBumps = dbOrder.selected_bumps as string[];
          if (selectedBumps && selectedBumps.length > 0) {
            selectedBumps.forEach(bumpId => productsToRegister.push({ id: bumpId, type: "bump" }));
          }
          for (const item of productsToRegister) {
            const { data: prodPrice } = await supabase.from("products").select("price").eq("id", item.id).single();
            const { data: newItem, error: itemErr } = await supabase.from("order_items").insert({
              order_id: dbOrder.id, product_id: item.id, amount: prodPrice?.price ?? 1, type: item.type
            }).select().single();
            if (itemErr) { console.error("Failed to insert order_item:", itemErr.message); }
            if (newItem) {
              try {
                await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                  body: JSON.stringify({ order_id: dbOrder.id, order_item_id: newItem.id }),
                });
              } catch (e) { console.warn(`Falha entrega item ${newItem.id}:`, e); }
            }
          }
        }
        
        return new Response(JSON.stringify({ status: "SUCCESS" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // If order is failed in DB
      if (dbOrder?.status === "failed") {
        return new Response(JSON.stringify({ status: "FAILED" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // 2. Order is still pending — try Débito API if we have a real debito_reference
      const realRef = dbOrder?.debito_reference;
      if (realRef) {
        // We have a real Débito reference — check with their API
        try {
          const statusRes = await fetch(`${DEBITO_API_URL}/transactions/${realRef}/status`, {
            headers: { "Authorization": `Bearer ${debitoToken}`, "Accept": "application/json" },
          });
          const statusText = await statusRes.text();
          let statusData: any;
          try { statusData = JSON.parse(statusText); } catch { statusData = {}; }
          
          const currentStatus = (statusData.status || "").toUpperCase();
          
          if (["SUCCESS", "PAID", "COMPLETED", "SUCCESSFUL"].includes(currentStatus)) {
            // Update order to paid
            if (dbOrder && dbOrder.status !== "paid") {
              await supabase.from("orders").update({ status: "paid" }).eq("id", dbOrder.id);
              
              // Create offer session if needed
              if (dbOrder.checkouts?.first_offer_id && dbOrder.customer_id) {
                const { data: existingOffer } = await supabase.from("offer_sessions").select("id").eq("order_id", dbOrder.id).maybeSingle();
                if (!existingOffer) {
                  await supabase.from("offer_sessions").insert({ offer_id: dbOrder.checkouts.first_offer_id, order_id: dbOrder.id, customer_id: dbOrder.customer_id, debito_reference: realRef });
                }
              }

              // Process deliveries
              const { data: existingItems } = await supabase.from("order_items").select("id").eq("order_id", dbOrder.id).limit(1);
              if (!existingItems || existingItems.length === 0) {
                const productsToRegister: { id: string; type: "main" | "bump" | "upsell" }[] = [
                  { id: dbOrder.checkouts.product_id, type: "main" }
                ];
                const selectedBumps = dbOrder.selected_bumps as string[];
                if (selectedBumps && selectedBumps.length > 0) {
                  selectedBumps.forEach(bumpId => productsToRegister.push({ id: bumpId, type: "bump" }));
                }
                for (const item of productsToRegister) {
                  const { data: prodPrice } = await supabase.from("products").select("price").eq("id", item.id).single();
                  const { data: newItem, error: itemErr } = await supabase.from("order_items").insert({
                    order_id: dbOrder.id, product_id: item.id, amount: prodPrice?.price ?? 1, type: item.type
                  }).select().single();
                  if (itemErr) { console.error("Failed to insert order_item:", itemErr.message); }
                  if (newItem) {
                    try {
                      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                        body: JSON.stringify({ order_id: dbOrder.id, order_item_id: newItem.id }),
                      });
                    } catch (e) { console.warn(`Falha entrega item ${newItem.id}:`, e); }
                  }
                }
              }
            }
            
            return new Response(JSON.stringify({ status: "SUCCESS" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else if (["FAILED", "EXPIRED", "CANCELLED"].includes(currentStatus)) {
            if (dbOrder) await supabase.from("orders").update({ status: "failed" }).eq("id", dbOrder.id);
            return new Response(JSON.stringify({ status: "FAILED" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          console.warn("Erro ao consultar status na API Débito:", e);
        }
      }
      
      // 3. Still pending (M-Pesa waiting for PIN, or no debito_reference yet)
      // Check upsell sessions too
      const { data: upsellSession } = await supabase
        .from("offer_sessions")
        .select("*, offers(*, products(*))")
        .eq("debito_reference", debito_reference)
        .is("decision", null)
        .maybeSingle();

      if (upsellSession) {
        // Check upsell status via Débito API
        try {
          const statusRes = await fetch(`${DEBITO_API_URL}/transactions/${debito_reference}/status`, {
            headers: { "Authorization": `Bearer ${debitoToken}`, "Accept": "application/json" },
          });
          const statusData = await statusRes.json();
          const currentStatus = (statusData.status || "").toUpperCase();
          
          if (["SUCCESS", "PAID", "COMPLETED", "SUCCESSFUL"].includes(currentStatus)) {
            const product = upsellSession.offers.products;
            const { data: upsellItem } = await supabase.from("order_items").insert({
              order_id: upsellSession.order_id, product_id: product.id, amount: product.price, type: "upsell"
            }).select().single();
            
            const { data: orderData } = await supabase.from("orders").select("total_amount").eq("id", upsellSession.order_id).single();
            if (orderData) {
              await supabase.from("orders").update({ total_amount: orderData.total_amount + product.price }).eq("id", upsellSession.order_id);
            }
            await supabase.from("offer_sessions").update({ decision: "accepted", decided_at: new Date().toISOString() }).eq("id", upsellSession.id);
            
            if (upsellItem) {
              try {
                await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/delivery-send`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                  body: JSON.stringify({ order_id: upsellSession.order_id, order_item_id: upsellItem.id }),
                });
              } catch (e) { console.warn("Falha entrega upsell:", e); }
            }
            
            return new Response(JSON.stringify({ status: "SUCCESS" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) { console.warn("Erro status upsell:", e); }
      }
      
      // Return pending — frontend will keep polling
      return new Response(JSON.stringify({ status: "PENDING" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");

  } catch (error) {
    console.error(`ERRO no Passo [${step}]:`, error.message);
    return new Response(JSON.stringify({ success: false, error: error.message, step }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200, // Retornamos 200 para capturar o erro no JSON do frontend
    });
  }
});
