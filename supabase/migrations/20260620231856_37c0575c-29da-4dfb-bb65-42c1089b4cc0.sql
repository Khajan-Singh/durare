DROP POLICY IF EXISTS "retailers update own store" ON public.stores;
CREATE POLICY "retailers update own store" ON public.stores
  FOR UPDATE TO authenticated
  USING (id = public.current_user_store() AND public.has_role(auth.uid(), 'retailer'::public.app_role))
  WITH CHECK (id = public.current_user_store() AND public.has_role(auth.uid(), 'retailer'::public.app_role));

DROP POLICY IF EXISTS "coordinators update own food bank" ON public.food_banks;
CREATE POLICY "coordinators update own food bank" ON public.food_banks
  FOR UPDATE TO authenticated
  USING (id = public.current_user_food_bank() AND public.has_role(auth.uid(), 'coordinator'::public.app_role))
  WITH CHECK (id = public.current_user_food_bank() AND public.has_role(auth.uid(), 'coordinator'::public.app_role));