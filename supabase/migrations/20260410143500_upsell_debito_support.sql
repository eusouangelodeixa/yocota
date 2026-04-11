-- Migração para suporte avançado a Upsell Débito (MZN)
-- Adiciona colunas para reutilizar carteiras de clientes
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_wallet_number TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_wallet_type TEXT;

-- Adiciona suporte a referências Débito em sessões de Upsell
ALTER TABLE public.offer_sessions ADD COLUMN IF NOT EXISTS debito_reference TEXT;

-- Índice para busca rápida de status de Upsell
CREATE INDEX IF NOT EXISTS idx_offer_sessions_debito_ref ON public.offer_sessions(debito_reference);
