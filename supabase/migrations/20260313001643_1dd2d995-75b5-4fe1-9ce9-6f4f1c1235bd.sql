CREATE POLICY "Public can view orders by payment intent"
ON public.orders
FOR SELECT
TO anon
USING (true);