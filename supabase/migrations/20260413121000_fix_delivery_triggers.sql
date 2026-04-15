-- Fix triggers to use correct net.http_post signature for pg_net v0.20.0
-- Signature: net.http_post(url, body, params, headers, timeout_milliseconds)

CREATE OR REPLACE FUNCTION fn_trigger_delivery_on_item_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_order_status text;
BEGIN
  SELECT status INTO v_order_status FROM orders WHERE id = NEW.order_id;
  IF v_order_status = 'paid' THEN
    PERFORM net.http_post(
      url     := 'https://fezewumhiwwplpgdline.supabase.co/functions/v1/delivery-send',
      body    := jsonb_build_object('order_id', NEW.order_id::text, 'order_item_id', NEW.id::text),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlemV3dW1oaXd3cGxwZ2RsaW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjkxOTksImV4cCI6MjA5MTI0NTE5OX0._E77wW5gV_3iF5Au-jMybKHJCOZ3oCD6jxX6cCwXwBQ'
      ),
      timeout_milliseconds := 15000
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

CREATE OR REPLACE FUNCTION fn_trigger_delivery_on_order_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    FOR v_item IN SELECT id FROM order_items WHERE order_id = NEW.id LOOP
      PERFORM net.http_post(
        url     := 'https://fezewumhiwwplpgdline.supabase.co/functions/v1/delivery-send',
        body    := jsonb_build_object('order_id', NEW.id::text, 'order_item_id', v_item.id::text),
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlemV3dW1oaXd3cGxwZ2RsaW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjkxOTksImV4cCI6MjA5MTI0NTE5OX0._E77wW5gV_3iF5Au-jMybKHJCOZ3oCD6jxX6cCwXwBQ'
        ),
        timeout_milliseconds := 15000
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
