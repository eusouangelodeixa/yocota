CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL DEFAULT 'Meu Negócio',
  logo_url text,
  default_redirect_url text,
  default_primary_color text DEFAULT '#2563eb',
  default_accent_color text DEFAULT '#1e40af',
  default_bg_color text DEFAULT '#f8fafc',
  default_cta_text text DEFAULT 'Finalizar compra',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (id) VALUES ('00000000-0000-0000-0000-000000000001');

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage site settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can view site settings"
  ON public.site_settings FOR SELECT TO anon
  USING (true);