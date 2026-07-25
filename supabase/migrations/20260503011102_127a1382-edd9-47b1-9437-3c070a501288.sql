
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
       AND p.proname IN (
         'handle_new_user',
         'bump_inquiry_updated_at',
         'notify_on_inquiry_status_change',
         'notify_on_new_message',
         'notify_on_new_inquiry',
         'enforce_listing_quota',
         'archive_stale_listings',
         'increment_listing_view_count',
         'update_updated_at_column',
         'touch_updated_at'
       )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated;',
                   fn.nspname, fn.proname, fn.args);
  END LOOP;
END $$;
