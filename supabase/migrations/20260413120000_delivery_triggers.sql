-- Enable pg_net for async HTTP calls from PostgreSQL triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- TRIGGER 1: Fire delivery when a new order_item is inserted
--            and the order is already paid (M-Pesa immediate SUCCESS)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_trigger_delivery_on_item_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_order_status text;
BEGIN
  SELECT status INTO v_order_status FROM orders WHERE id = NEW.order_id;
  IF v_order_status = 'paid' THEN
    PERFORM pg_net.http_post(
      url     := 'https://fezewumhiwwplpgdline.supabase.co/functions/v1/delivery-send',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlemV3dW1oaXd3cGxwZ2RsaW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjkxOTksImV4cCI6MjA5MTI0NTE5OX0._E77wW5gV_3iF5Au-jMybKHJCOZ3oCD6jxX6cCwXwBQ'
      ),
      body    := jsonb_build_object(
        'order_id',      NEW.order_id::text,
        'order_item_id', NEW.id::text
      )
    );
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_delivery_on_item_insert ON order_items;
CREATE TRIGGER trg_delivery_on_item_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_delivery_on_item_insert();

-- ============================================================
-- TRIGGER 2: Fire delivery when an order is marked as 'paid'
--            for all existing order_items (e-Mola webhook path)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_trigger_delivery_on_order_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    FOR v_item IN SELECT id FROM order_items WHERE order_id = NEW.id LOOP
      PERFORM pg_net.http_post(
        url     := 'https://fezewumhiwwplpgdline.supabase.co/functions/v1/delivery-send',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlemV3dW1oaXd3cGxwZ2RsaW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjkxOTksImV4cCI6MjA5MTI0NTE5OX0._E77wW5gV_3iF5Au-jMybKHJCOZ3oCD6jxX6cCwXwBQ'
        ),
        body    := jsonb_build_object(
          'order_id',      NEW.id::text,
          'order_item_id', v_item.id::text
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_delivery_on_order_paid ON orders;
CREATE TRIGGER trg_delivery_on_order_paid
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_delivery_on_order_paid();
