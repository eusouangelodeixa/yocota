
-- Add customization columns to checkouts
ALTER TABLE public.checkouts 
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#1e40af',
  ADD COLUMN IF NOT EXISTS bg_color text DEFAULT '#f8fafc',
  ADD COLUMN IF NOT EXISTS headline_text text,
  ADD COLUMN IF NOT EXISTS cta_text text DEFAULT 'Finalizar compra',
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS show_product_image boolean DEFAULT true;

-- Add currency and image to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'brl',
  ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for product-images bucket: authenticated users can manage
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');
