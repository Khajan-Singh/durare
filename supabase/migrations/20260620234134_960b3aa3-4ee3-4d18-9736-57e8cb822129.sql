
-- daily_sales: restrict SELECT
DROP POLICY IF EXISTS "daily_sales readable by authenticated" ON public.daily_sales;
CREATE POLICY "daily_sales readable by store or coordinator"
  ON public.daily_sales FOR SELECT TO authenticated
  USING (
    store_id = public.current_user_store()
    OR public.has_role(auth.uid(), 'coordinator'::app_role)
  );

-- inventory_snapshots: restrict SELECT
DROP POLICY IF EXISTS "inventory readable by authenticated" ON public.inventory_snapshots;
CREATE POLICY "inventory readable by store or coordinator"
  ON public.inventory_snapshots FOR SELECT TO authenticated
  USING (
    store_id = public.current_user_store()
    OR public.has_role(auth.uid(), 'coordinator'::app_role)
  );

-- predictions: restrict SELECT
DROP POLICY IF EXISTS "predictions readable by authenticated" ON public.predictions;
CREATE POLICY "predictions readable by store or coordinator"
  ON public.predictions FOR SELECT TO authenticated
  USING (
    store_id = public.current_user_store()
    OR public.has_role(auth.uid(), 'coordinator'::app_role)
  );

-- pickups: restrict SELECT to retailer's store or coordinator's food bank
DROP POLICY IF EXISTS "pickups readable by authenticated" ON public.pickups;
CREATE POLICY "pickups readable by partners"
  ON public.pickups FOR SELECT TO authenticated
  USING (
    store_id = public.current_user_store()
    OR food_bank_id = public.current_user_food_bank()
  );

-- profiles: tighten UPDATE with WITH CHECK preventing role/org changes
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND store_id IS NOT DISTINCT FROM (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    AND food_bank_id IS NOT DISTINCT FROM (SELECT food_bank_id FROM public.profiles WHERE id = auth.uid())
  );
