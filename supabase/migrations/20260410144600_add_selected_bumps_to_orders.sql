-- Migração para suporte a registo de Order Bumps em pagamentos assíncronos (Débito)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS selected_bumps JSONB DEFAULT '[]'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.orders.selected_bumps IS 'IDs dos Order Bumps selecionados no checkout para processamento após confirmação do pagamento';
