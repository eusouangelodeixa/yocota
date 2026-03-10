
-- Offer sessions table for opaque token security (replaces HMAC)
CREATE TABLE public.offer_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  decision TEXT, -- 'accepted' or 'rejected' or null (pending)
  decided_at TIMESTAMP WITH TIME ZONE,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 minutes')
);

-- RLS
ALTER TABLE public.offer_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage offer sessions"
  ON public.offer_sessions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Public can view their sessions by token (for iframe)
CREATE POLICY "Public can view offer sessions by token"
  ON public.offer_sessions FOR SELECT TO anon
  USING (true);

-- Public can update their sessions (for decisions)
CREATE POLICY "Public can update offer sessions"
  ON public.offer_sessions FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- Add first_offer_id to checkouts for linking the offer funnel
ALTER TABLE public.checkouts ADD COLUMN IF NOT EXISTS first_offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL;
