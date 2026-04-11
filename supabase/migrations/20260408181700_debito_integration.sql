-- Migration to add Debito integration columns
-- Date: 2026-04-08

-- Update orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS debito_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe';

-- Update customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_wallet_number TEXT;

-- Update order_status enum to ensure 'pending' exists 
-- (Note: In Supabase, you can't easily DO IF NOT EXISTS for enum values via SQL, 
-- but usually it's already there if we're using the standard system)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'order_status' AND e.enumlabel = 'pending') THEN
        ALTER TYPE order_status ADD VALUE 'pending';
    END IF;
END
$$;
