-- Add tracking pixel fields to checkouts
ALTER TABLE checkouts
  ADD COLUMN IF NOT EXISTS fb_pixel_id        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_ads_id      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_ads_label   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tiktok_pixel_id    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gtm_id             TEXT DEFAULT NULL;

COMMENT ON COLUMN checkouts.fb_pixel_id      IS 'Meta (Facebook) Pixel ID';
COMMENT ON COLUMN checkouts.google_ads_id    IS 'Google Ads conversion ID (AW-XXXXXXXXX)';
COMMENT ON COLUMN checkouts.google_ads_label IS 'Google Ads conversion label';
COMMENT ON COLUMN checkouts.tiktok_pixel_id  IS 'TikTok Pixel ID';
COMMENT ON COLUMN checkouts.gtm_id           IS 'Google Tag Manager Container ID (GTM-XXXXXX)';
