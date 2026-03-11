
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Create function to clean old audit logs (keep last 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.audit_logs
  WHERE created_at < now() - interval '90 days';
$$;

-- Schedule cleanup daily at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 3 * * *',
  'SELECT public.cleanup_old_audit_logs()'
);
