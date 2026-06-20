
-- 1. Helper functions (SECURITY DEFINER to avoid RLS recursion when policies on profiles reference profiles)
CREATE OR REPLACE FUNCTION public.current_user_store()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_food_bank()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT food_bank_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_store() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_food_bank() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_store() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_food_bank() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2. Profiles: replace broad SELECT with a scoped one
DROP POLICY IF EXISTS "authenticated read profile contact info" ON public.profiles;

CREATE POLICY "read pickup partner profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT p.confirmed_by FROM public.pickups p
      WHERE p.confirmed_by IS NOT NULL
        AND (
          p.store_id = public.current_user_store()
          OR p.food_bank_id = public.current_user_food_bank()
        )
    )
  );

-- 3. Prevent privilege escalation on profile updates via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.food_bank_id IS DISTINCT FROM OLD.food_bank_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Modifying role, store_id, food_bank_id, or id is not permitted';
  END IF;
  RETURN NEW;
END
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 4. Stores INSERT: only retailers
DROP POLICY IF EXISTS "authenticated can insert stores" ON public.stores;
CREATE POLICY "retailers can insert stores" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'retailer'::public.app_role));

-- 5. Food banks INSERT: only coordinators
DROP POLICY IF EXISTS "authenticated can insert food banks" ON public.food_banks;
CREATE POLICY "coordinators can insert food banks" ON public.food_banks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coordinator'::public.app_role));

-- 6. Items INSERT: only retailers (used by retailer add-inventory flow)
DROP POLICY IF EXISTS "Authenticated can insert items" ON public.items;
CREATE POLICY "retailers can insert items" ON public.items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'retailer'::public.app_role));

-- 7. Predictions INSERT: only service role (model run uses admin client)
DROP POLICY IF EXISTS "authenticated can insert predictions" ON public.predictions;
-- no replacement policy; service_role bypasses RLS

-- 8. Pickups UPDATE: require coordinator role and matching food bank, on both USING and WITH CHECK
DROP POLICY IF EXISTS "coordinators update own pickups" ON public.pickups;
CREATE POLICY "coordinators update own pickups" ON public.pickups
  FOR UPDATE TO authenticated
  USING (
    food_bank_id = public.current_user_food_bank()
    AND public.has_role(auth.uid(), 'coordinator'::public.app_role)
  )
  WITH CHECK (
    food_bank_id = public.current_user_food_bank()
    AND public.has_role(auth.uid(), 'coordinator'::public.app_role)
  );
