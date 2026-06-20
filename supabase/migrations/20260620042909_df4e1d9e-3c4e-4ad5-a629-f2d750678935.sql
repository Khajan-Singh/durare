
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS sales_q10 numeric,
  ADD COLUMN IF NOT EXISTS sales_q50 numeric,
  ADD COLUMN IF NOT EXISTS sales_q90 numeric,
  ADD COLUMN IF NOT EXISTS qty_on_hand numeric,
  ADD COLUMN IF NOT EXISTS snapshot_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS attribution jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.predictions
  ALTER COLUMN predicted_surplus_qty DROP NOT NULL,
  ALTER COLUMN confidence_low DROP NOT NULL,
  ALTER COLUMN confidence_high DROP NOT NULL,
  ALTER COLUMN target_date DROP NOT NULL;
