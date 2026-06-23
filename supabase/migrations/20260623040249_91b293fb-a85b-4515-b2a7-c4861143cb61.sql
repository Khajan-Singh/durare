REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_store() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_food_bank() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_store() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_food_bank() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() TO service_role;