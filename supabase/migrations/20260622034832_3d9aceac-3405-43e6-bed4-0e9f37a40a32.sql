
-- Helper: current user's role (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Profiles UPDATE: scope to authenticated, enforce immutability of role/store/food_bank in WITH CHECK
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = public.current_user_role()
  AND store_id IS NOT DISTINCT FROM public.current_user_store()
  AND food_bank_id IS NOT DISTINCT FROM public.current_user_food_bank()
);

-- Stores INSERT: only allow when the inserting user is a retailer who does not yet
-- have a store assigned (signup path), preventing arbitrary additional store rows.
DROP POLICY IF EXISTS "retailers can insert stores" ON public.stores;
CREATE POLICY "retailers can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (
  -- First-time signup: profile not yet inserted
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  OR (
    public.has_role(auth.uid(), 'retailer'::app_role)
    AND public.current_user_store() IS NULL
  )
);
