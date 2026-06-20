## Predictions: store raw model output, derive display fields on read

The model now writes only **raw** forecast values; the app derives everything the UI shows. All derivation happens in one place — `src/lib/data.ts` — so components keep consuming the same `PredictionWithRefs` shape they do today.

### 1. Schema migration (`predictions` table)

Add raw columns the model will write:
- `sales_q10 numeric NOT NULL`
- `sales_q50 numeric NOT NULL`
- `sales_q90 numeric NOT NULL`
- `qty_on_hand numeric NOT NULL`
- `snapshot_date date NOT NULL`
- `expiry_date date NOT NULL`
- `category text`
- `state text`
- `attribution jsonb NOT NULL DEFAULT '{}'::jsonb`

Drop reliance on the stored derived columns (`predicted_surplus_qty`, `confidence_low`, `confidence_high`, `target_date`, `drivers`):
- Make them nullable so the model can stop writing them without breaking inserts.
- Leave the columns in place for one migration (no data loss); the data layer ignores them.

No grant/RLS changes — existing policies still apply.

### 2. Data layer (`src/lib/data.ts`)

- Add `RawPrediction` type matching the new columns.
- `fetchPredictions()` selects raw columns + joins, then maps each row through a new `derivePrediction(raw)` that returns the existing `PredictionWithRefs` shape (so `prediction-card.tsx`, `confidence-bar.tsx`, coordinator dashboard, and confirm-pickup modal don't change).
- `derivePrediction(raw)` computes, per the spec:
  - `days_to_expiry = expiry_date − snapshot_date` (whole days)
  - `predicted_surplus_qty = round(qty_on_hand − sales_q50)`
  - `confidence_low = round(qty_on_hand − sales_q90)`
  - `confidence_high = round(qty_on_hand − sales_q10)`
  - `rel_width = (confidence_high − confidence_low) / max(predicted_surplus_qty, 1)`
  - `buffer`: `<0.6 → 3`, `<1.2 → 2`, `else → 1`
  - `target_date = expiry_date − buffer`, clamped to `[snapshot_date, expiry_date − 1]`
  - `confidenceLabel`: high / moderate / low from `rel_width`
  - `drivers`: assemble the four-part sentence (arithmetic line, causal clauses from `attribution.recent_trend` / `promo_active` / `window_days` only, confidence label, pickup rationale with formatted target date). Skip any causal clause whose attribution field is missing — never invent reasons.
- All numeric display values rounded to whole units.
- Existing `Prediction` / `PredictionWithRefs` types updated so `predicted_surplus_qty`, `confidence_low`, `confidence_high`, `target_date`, `drivers` come from the derivation, not the row.

### 3. Model service (`model-service/`)

Update `main.py` response contract to match the new table:
- Output per row: `sales_q10`, `sales_q50`, `sales_q90`, `attribution` (JSON with `recent_trend`, `promo_active`, `window_days`), `model_version`.
- Remove server-side derivation of `predicted_surplus_qty`, `confidence_low`, `confidence_high`, `target_date`, `days_to_expiry`, `drivers` — the app owns those now.
- README updated to reflect the new contract and to document that quantiles are TOTAL sales over the snapshot→expiry window.

### 4. Components

No changes. They already render `predicted_surplus_qty`, the confidence band, `target_date`, `days_to_expiry`, and `drivers` from `PredictionWithRefs`; only the source changes.

### Worked-example sanity check (matches the spec)

Raw: `qty=60, q10=30.5, q50=41.2, q90=49.8, snapshot=06-19, expiry=06-25`
→ surplus 19, band 10–30, rel_width ≈ 1.03 → moderate → buffer 2 → target_date 06-23, days_to_expiry 6. ✓

### Open question

The current `predictions` columns `predicted_surplus_qty`, `confidence_low`, `confidence_high`, `target_date`, `drivers` are `NOT NULL`. Plan is to make them nullable now and drop them in a later cleanup migration. Say "drop them now" if you'd rather remove them in this same migration.
