
ALTER TABLE public.checkouts
  ADD COLUMN IF NOT EXISTS countdown_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS countdown_duration integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS countdown_text text NOT NULL DEFAULT 'Essa oferta expira em:',
  ADD COLUMN IF NOT EXISTS countdown_bg_color text NOT NULL DEFAULT '#dc2626',
  ADD COLUMN IF NOT EXISTS countdown_text_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS social_proof_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_proof_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS social_proof_interval integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS social_proof_display_duration integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS social_proof_position text NOT NULL DEFAULT 'bottom-left';
