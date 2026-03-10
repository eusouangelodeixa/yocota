

## Sistema de Checkout & Motor de Upsell — Fase 1
*Adaptado do PRD v1.0.0 para stack Lovable (React + Vite + Supabase)*

### Mapeamento de Stack
| PRD Original | Lovable Equivalente |
|---|---|
| Next.js App Router | React + React Router |
| NextAuth.js | Supabase Auth (email/senha) |
| Prisma ORM | Supabase Client + Database |
| Route Handlers | Supabase Edge Functions |
| BullMQ + Redis | Supabase Edge Functions + pg_cron (futuro) |

---

### 1. Banco de Dados (Schema exato do PRD seção 2.4)

Criar todas as tabelas via migrations Supabase:
- **admin_users**: id, email, password_hash, created_at
- **products**: id, name, description, price (centavos!), type (enum), stripe_product_id, stripe_price_id, delivery_type, delivery_message, delivery_attachment, active, created_at
- **checkouts**: id, product_id (FK), name, checkout_slug (unique), redirect_url, order_bump_product_id (FK nullable), active, created_at
- **customers**: id, name, email, phone, stripe_customer_id, stripe_payment_method_id, created_at
- **orders**: id, customer_id (FK), checkout_id (FK), total_amount (centavos), status (enum: pending/paid/failed/refunded), stripe_payment_intent_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at
- **order_items**: id, order_id (FK), product_id (FK), amount (centavos), type (enum)
- **offers**: id, product_id (FK), name, page_url, iframe_id (unique), accept_next_offer_id (FK self), reject_next_offer_id (FK self), created_at
- **abandoned_checkouts**: id, checkout_id (FK), name, email, phone, recovery_token, token_expires_at, utm_data (jsonb), recovered, whatsapp_sent_at, created_at
- **deliveries**: id, order_id (FK), order_item_id (FK), phone, message, status (enum), created_at

RLS policies para proteger todas as tabelas.

---

### 2. Autenticação (AUTH-01 a AUTH-04)

- Login com email/senha via Supabase Auth
- Página `/login` com formulário
- Middleware de proteção: todas as rotas `/admin/*` requerem sessão ativa
- Redirect para `/login` se não autenticado
- Botão de logout com invalidação de sessão
- Sessão gerenciada por Supabase (JWT httpOnly)

---

### 3. Painel Admin — Layout Base

- Sidebar com navegação: Dashboard, Produtos, Checkouts, Ofertas, Pedidos, Entregas, Remarketing, Configurações
- Layout responsivo com header e área de conteúdo
- Proteção de rota em todas as páginas admin

---

### 4. CRUD de Produtos (PROD-01 a PROD-06)

- Página `/admin/produtos` com listagem paginada (20/página) e filtro por tipo
- Formulário de criação com validação Zod (nome min 3 chars, preço > 0 centavos)
- **Sincronização Stripe**: ao criar produto, chamar Edge Function que cria Product + Price no Stripe
- Edição com sync de nome/descrição no Stripe
- Soft delete (active = false), sem excluir do Stripe
- Campo de mensagem de entrega com variáveis `{{nome}}`, `{{email}}`, `{{produto}}`

---

### 5. CRUD de Checkouts (CHK-01 a CHK-07)

- Página `/admin/checkouts` com listagem
- Criação vinculando produto principal + slug auto-gerado (sanitizado do nome)
- Validação de unicidade do slug
- Campo obrigatório de URL de redirecionamento
- Order bump opcional (selecionar produto adicional)
- Copiar URL pública com 1 clique
- Toggle ativar/desativar

---

### 6. Página Pública de Checkout (PAGE-01 a PAGE-12)

- Rota `/checkout/:slug` — renderiza dados do produto
- Formulário: nome, email, telefone (formato E.164)
- Captura de UTMs da URL → sessionStorage
- Registro de lead (abandoned_checkout) ao preencher email
- **Stripe Elements** integrado (Card Element) — dados de cartão nunca tocam o servidor
- Checkbox de order bump com preço total dinâmico
- Fluxo de pagamento:
  1. Chamar Edge Function `create-intent` → cria PaymentIntent
  2. `stripe.confirmCardPayment()` no frontend
  3. Chamar Edge Function `confirm-payment` → verifica com Stripe, cria Customer, salva PaymentMethod, cria order + order_items em transação
  4. Retorna URL de redirecionamento
- Loading state durante processamento
- Mensagens de erro em PT-BR
- Checkout inativo → página 404

---

### 7. Webhook Stripe (Edge Function)

- Edge Function `/stripe-webhook` processando eventos:
  - `payment_intent.succeeded` → confirmar pedido, atualizar status para "paid"
  - `payment_intent.payment_failed` → status "failed"
  - `customer.created` → atualizar stripe_customer_id
  - `payment_method.attached` → salvar stripe_payment_method_id
- **Validação obrigatória** com `stripe.webhooks.constructEvent()`
- Processamento idempotente via event.id
- Proteção contra cobrança duplicada

---

### 8. Edge Functions Necessárias

- `create-intent`: cria PaymentIntent no Stripe
- `confirm-payment`: verifica pagamento, cria order/items
- `stripe-webhook`: processa eventos Stripe
- `sync-product`: sincroniza produto com Stripe (criar/atualizar)

---

### Regras de Segurança Aplicadas
- Valores monetários sempre em centavos (integer)
- Dados de cartão nunca tocam o servidor (Stripe Elements)
- Webhook validado com constructEvent()
- Proteção contra cobrança duplicada em todas as operações
- Queries sempre via Supabase Client (zero raw SQL)

