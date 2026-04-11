-- Migração para adicionar suporte a referências de pagamento da Débito
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS debito_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider_order_id TEXT;

-- Índices para performance nas buscas do Webhook
CREATE INDEX IF NOT EXISTS idx_orders_debito_ref ON public.orders(debito_reference);
CREATE INDEX IF NOT EXISTS idx_orders_provider_id ON public.orders(provider_order_id);
