
-- Allow authenticated users to create their own store / food bank during signup
CREATE POLICY "authenticated can insert stores" ON public.stores
  FOR INSERT TO authenticated WITH CHECK (true);
GRANT INSERT ON public.stores TO authenticated;

CREATE POLICY "authenticated can insert food banks" ON public.food_banks
  FOR INSERT TO authenticated WITH CHECK (true);
GRANT INSERT ON public.food_banks TO authenticated;
