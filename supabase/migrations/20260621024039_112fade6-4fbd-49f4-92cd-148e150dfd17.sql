
-- Fix infinite recursion in profiles UPDATE policy by removing self-referential
-- subqueries from WITH CHECK. Immutability of role/store_id/food_bank_id is
-- already enforced by the prevent_profile_privilege_escalation() function,
-- which we now attach as a trigger.

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;

CREATE POLICY "users update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;

CREATE TRIGGER prevent_profile_privilege_escalation_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
