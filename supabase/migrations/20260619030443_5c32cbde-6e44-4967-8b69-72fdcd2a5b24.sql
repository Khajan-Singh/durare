
-- Role enum
CREATE TYPE public.app_role AS ENUM ('retailer','coordinator');

-- Stores
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  type TEXT NOT NULL DEFAULT 'grocery',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores readable by authenticated" ON public.stores FOR SELECT TO authenticated USING (true);

-- Food banks
CREATE TABLE public.food_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  capacity INT NOT NULL DEFAULT 0,
  cold_storage BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_banks TO authenticated;
GRANT ALL ON public.food_banks TO service_role;
ALTER TABLE public.food_banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food banks readable by authenticated" ON public.food_banks FOR SELECT TO authenticated USING (true);

-- Items
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  shelf_life_days INT NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items readable by authenticated" ON public.items FOR SELECT TO authenticated USING (true);

-- Profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  role public.app_role NOT NULL,
  store_id UUID REFERENCES public.stores(id),
  food_bank_id UUID REFERENCES public.food_banks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role);
$$;

-- Inventory snapshots
CREATE TABLE public.inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  qty_on_hand INT NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_snapshots TO authenticated;
GRANT ALL ON public.inventory_snapshots TO service_role;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory readable by authenticated" ON public.inventory_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "retailers manage own store inventory insert" ON public.inventory_snapshots FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "retailers manage own store inventory update" ON public.inventory_snapshots FOR UPDATE TO authenticated
  USING (store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "retailers manage own store inventory delete" ON public.inventory_snapshots FOR DELETE TO authenticated
  USING (store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid()));

-- Predictions (read-only for app; populated externally)
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  predicted_surplus_qty INT NOT NULL,
  confidence_low INT NOT NULL,
  confidence_high INT NOT NULL,
  drivers TEXT,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions readable by authenticated" ON public.predictions FOR SELECT TO authenticated USING (true);

-- Pickups
CREATE TABLE public.pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_bank_id UUID NOT NULL REFERENCES public.food_banks(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  confirmed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickups TO authenticated;
GRANT ALL ON public.pickups TO service_role;
ALTER TABLE public.pickups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pickups readable by authenticated" ON public.pickups FOR SELECT TO authenticated USING (true);
CREATE POLICY "coordinators insert pickups for own food bank" ON public.pickups FOR INSERT TO authenticated
  WITH CHECK (food_bank_id IN (SELECT food_bank_id FROM public.profiles WHERE id = auth.uid()) AND public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "coordinators update own pickups" ON public.pickups FOR UPDATE TO authenticated
  USING (food_bank_id IN (SELECT food_bank_id FROM public.profiles WHERE id = auth.uid()));
