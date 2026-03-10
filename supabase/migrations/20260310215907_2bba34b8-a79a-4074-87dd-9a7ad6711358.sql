
-- Enums
CREATE TYPE public.product_type AS ENUM ('digital', 'physical', 'service');
CREATE TYPE public.delivery_type AS ENUM ('whatsapp', 'email', 'none');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE public.order_item_type AS ENUM ('main', 'bump', 'upsell');
CREATE TYPE public.delivery_status AS ENUM ('pending', 'sent', 'failed');

-- Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) >= 3),
  description TEXT,
  price INTEGER NOT NULL CHECK (price > 0),
  type product_type NOT NULL DEFAULT 'digital',
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  delivery_type delivery_type NOT NULL DEFAULT 'none',
  delivery_message TEXT,
  delivery_attachment TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checkouts
CREATE TABLE public.checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  name TEXT NOT NULL,
  checkout_slug TEXT NOT NULL UNIQUE,
  redirect_url TEXT NOT NULL,
  order_bump_product_id UUID REFERENCES public.products(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_customers_email ON public.customers(email);

-- Orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  checkout_id UUID NOT NULL REFERENCES public.checkouts(id),
  total_amount INTEGER NOT NULL CHECK (total_amount > 0),
  status order_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT UNIQUE,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order Items
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  type order_item_type NOT NULL DEFAULT 'main'
);

-- Offers
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  name TEXT NOT NULL,
  page_url TEXT,
  iframe_id TEXT UNIQUE,
  accept_next_offer_id UUID REFERENCES public.offers(id),
  reject_next_offer_id UUID REFERENCES public.offers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Abandoned Checkouts
CREATE TABLE public.abandoned_checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_id UUID NOT NULL REFERENCES public.checkouts(id),
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  recovery_token TEXT,
  token_expires_at TIMESTAMPTZ,
  utm_data JSONB,
  recovered BOOLEAN NOT NULL DEFAULT false,
  whatsapp_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deliveries
CREATE TABLE public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id),
  phone TEXT,
  message TEXT,
  status delivery_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook events (idempotency)
CREATE TABLE public.stripe_webhook_events (
  id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abandoned_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can view active products" ON public.products FOR SELECT TO anon USING (active = true);

CREATE POLICY "Admins can manage checkouts" ON public.checkouts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can view active checkouts" ON public.checkouts FOR SELECT TO anon USING (active = true);

CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can create customers" ON public.customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public can view customers" ON public.customers FOR SELECT TO anon USING (true);

CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can create orders" ON public.orders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Admins can manage order items" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can create order items" ON public.order_items FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Admins can manage offers" ON public.offers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can view offers" ON public.offers FOR SELECT TO anon USING (true);

CREATE POLICY "Admins can manage abandoned checkouts" ON public.abandoned_checkouts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can create abandoned checkouts" ON public.abandoned_checkouts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public can update abandoned checkouts" ON public.abandoned_checkouts FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage deliveries" ON public.deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service can manage webhook events" ON public.stripe_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_checkout ON public.orders(checkout_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_stripe_pi ON public.orders(stripe_payment_intent_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_checkouts_slug ON public.checkouts(checkout_slug);
CREATE INDEX idx_abandoned_email ON public.abandoned_checkouts(email);
CREATE INDEX idx_abandoned_token ON public.abandoned_checkouts(recovery_token);
