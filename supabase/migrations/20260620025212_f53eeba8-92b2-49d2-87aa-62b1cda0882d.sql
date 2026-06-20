
CREATE POLICY "Authenticated can insert items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (true);
GRANT INSERT ON public.items TO authenticated;
