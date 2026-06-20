
ALTER TABLE public.inventory_snapshots
  ADD COLUMN IF NOT EXISTS catalog_item_id text,
  ADD COLUMN IF NOT EXISTS catalog_category_id text,
  ADD COLUMN IF NOT EXISTS shelf_life_days integer;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS state text;

CREATE TABLE IF NOT EXISTS public.daily_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  catalog_item_id text NOT NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  units_sold numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (store_id, catalog_item_id, sale_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_sales TO authenticated;
GRANT ALL ON public.daily_sales TO service_role;

ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_sales readable by authenticated" ON public.daily_sales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "retailers insert own store sales" ON public.daily_sales
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT profiles.store_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "retailers update own store sales" ON public.daily_sales
  FOR UPDATE TO authenticated
  USING (store_id IN (SELECT profiles.store_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "retailers delete own store sales" ON public.daily_sales
  FOR DELETE TO authenticated
  USING (store_id IN (SELECT profiles.store_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE INDEX IF NOT EXISTS daily_sales_store_item_date_idx
  ON public.daily_sales (store_id, catalog_item_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS inventory_snapshots_catalog_item_idx
  ON public.inventory_snapshots (catalog_item_id);
