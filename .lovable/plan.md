## Locked I/O contract

**App → Python service** (`POST /predict`):

```json
{
  "rows": [{
    "store_id": "uuid-or-code",
    "item_id": "fuji_apple",
    "category": "fresh_fruits",
    "state": "CA",
    "snapshot_date": "2026-06-20",
    "expiry_date": "2026-06-27",
    "qty_on_hand": 42,
    "model_version": "v1"
  }]
}
```

**Service → App** (one entry per input row):

```json
{
  "predictions": [{
    "predicted_sales_q50": 41.2,
    "predicted_surplus_qty": 18.8,
    "confidence_low": 5.1,
    "confidence_high": 30.4,
    "target_date": "2026-06-25",
    "days_to_expiry": 7,
    "drivers": "High weekend demand + 3-day buffer before expiry; pickup recommended by Wednesday."
  }]
}
```

The 17 model features (`dow, is_weekend, month, is_holiday, is_promo, shelf_life_days, item_id_code, category_code, store_id_code, state_code, days_until_expiry, is_near_expiry, lag_1, lag_7, roll_7, roll_28, roll_std_7`) are derived **inside the Python service** from those 8 inputs + bundled `encoders.json` + `item_catalog.csv` + sales history. The Lovable app never deals with that math.

### How the service fills the 17 features

| Model feature | Source inside the service |
|---|---|
| `dow`, `is_weekend`, `month` | derived from `snapshot_date` |
| `is_holiday` | `holidays` Python package, keyed by `state` + date |
| `is_promo` | defaults to `false` (no promo tracking in the app yet) |
| `shelf_life_days` | bundled `item_catalog.csv` lookup by `item_id` |
| `item_id_code`, `category_code`, `store_id_code`, `state_code` | `encoders.json` lookup (your training mappings) |
| `days_until_expiry`, `is_near_expiry` | `expiry_date − snapshot_date` |
| `lag_1`, `lag_7`, `roll_7`, `roll_28`, `roll_std_7` | computed from sales history |

### How outputs are produced

- `predicted_sales_q50`, plus q10 / q90 from a quantile-regression model (or three separate models trained at α = 0.1/0.5/0.9).
- `predicted_surplus_qty = qty_on_hand − predicted_sales_q50`
- `confidence_low = qty_on_hand − sales_q90` (most sales scenario → least left)
- `confidence_high = qty_on_hand − sales_q10` (fewest sales scenario → most left)
- `days_to_expiry = expiry_date − snapshot_date`
- `target_date = expiry_date − safety_buffer (default 2 days)`, nudged later when `confidence_low > 0` and earlier when `confidence_high` is near 0.
- `drivers` is a templated sentence assembled from the top contributing factors (calendar, holiday flag, days-to-expiry, surplus magnitude). Deterministic, no LLM call.

---

## Two open questions before I start building

1. **Sales history transport** — needed for the lag/roll features:
   - **App-side (recommended)**: app attaches `sales_history: [{date, units}, ...]` per row to the request. Python service stays stateless and credential-free.
   - **Service-side**: Python service queries Lovable DB directly with a read-only key. Cleaner contract, but couples the service to your DB.

2. **Quantile model shape**: is `xgboost_model.json`
   - one quantile-regression model emitting q10/q50/q90,
   - three separate files (q10, q50, q90),
   - or a single q50 model (we'd approximate q10/q90 from a residual std-dev multiplier)?

---

## Build order after you answer

1. Replace `src/lib/food-catalog.ts` with data from `item_catalog.csv`; add `item_id`, `category_id`, `shelf_life_days` to `inventory_snapshots`.
2. New `daily_sales` table (store_id, item_id, sale_date, units_sold) + retailer "Log sales" form.
3. Add `stores.state` (2-letter) + reverse-geocode server fn via Google Maps connector + backfill existing stores.
4. Scaffold `model-service/` (FastAPI, `main.py`, `model_loader.py`, `requirements.txt`, `Dockerfile`, `README.md`) matching the contract above.
5. Pause — you drop in `xgboost_model.json` + `encoders.json`, push, deploy to Render, paste URL + API key back.
6. Wire `refreshPredictionsInRadius()` server fn + "Refresh predictions" button on coordinator dashboard.
7. End-to-end test with one store.

Reply with answers to the two questions + "go" and I'll execute steps 1–4 in one batch.