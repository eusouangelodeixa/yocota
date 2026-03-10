
-- Create junction table for multiple order bumps per checkout
CREATE TABLE public.checkout_order_bumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id uuid NOT NULL REFERENCES public.checkouts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(checkout_id, product_id)
);

-- Enable RLS
ALTER TABLE public.checkout_order_bumps ENABLE ROW LEVEL SECURITY;

-- Admin can manage
CREATE POLICY "Admins can manage checkout order bumps"
ON public.checkout_order_bumps FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Public can view (needed for checkout page)
CREATE POLICY "Public can view checkout order bumps"
ON public.checkout_order_bumps FOR SELECT
TO anon
USING (true);

-- Migrate existing order_bump_product_id data
INSERT INTO public.checkout_order_bumps (checkout_id, product_id, sort_order)
SELECT id, order_bump_product_id, 0
FROM public.checkouts
WHERE order_bump_product_id IS NOT NULL
ON CONFLICT DO NOTHING;
