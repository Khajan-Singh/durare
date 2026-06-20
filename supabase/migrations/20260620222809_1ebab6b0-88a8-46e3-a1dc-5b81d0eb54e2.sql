
-- Allow authenticated users to read minimal profile fields of other users
-- (needed so retailers see the coordinator who claimed a pickup, and
-- coordinators see retailer-side info). The existing "users read own profile"
-- policy stays; PostgreSQL ORs SELECT policies.
CREATE POLICY "authenticated read profile contact info"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Optional human-readable street address for a food bank, shown in the
-- pickup details popup. Nullable so existing rows are unaffected.
ALTER TABLE public.food_banks ADD COLUMN IF NOT EXISTS address text;
