# Durare Surplus Forecast Service

FastAPI wrapper around the XGBoost surplus-forecast model. The Lovable app
sends 8 simple inputs per row; this service derives the 17 training features
internally and returns RAW quantile output (`sales_q10`, `sales_q50`,
`sales_q90`) plus an `attribution` JSON. The Lovable app derives surplus,
confidence band, target_date, days_to_expiry, and the "Why this forecast?"
drivers on read — this service must never compute or fabricate them.

`sales_qXX` are TOTAL units expected to sell over the snapshot→expiry window.

## What you need to put in this folder

1. **`xgboost_model.json`** — your trained model (Booster.save_model output).
   - For three-quantile setup, name them `xgboost_model_q10.json`,
     `xgboost_model_q50.json`, `xgboost_model_q90.json` and set
     `MODEL_LAYOUT=three`.
2. **`encoders.json`** — integer mappings used during training. Format:
   ```json
   {
     "item_id":  {"fuji_apple": 0, "gala_apple": 1, ...},
     "category": {"fresh_fruits": 0, "fresh_vegetables": 1, ...},
     "store_id": {"<your-uuid-or-code>": 0, ...},
     "state":    {"CA": 0, "TX": 1, ...}
   }
   ```
   If you used sklearn `LabelEncoder` in training, export with:
   ```python
   import json
   json.dump({
     "item_id":  dict(zip(le_item.classes_,  range(len(le_item.classes_)))),
     "category": dict(zip(le_cat.classes_,   range(len(le_cat.classes_)))),
     "store_id": dict(zip(le_store.classes_, range(len(le_store.classes_)))),
     "state":    dict(zip(le_state.classes_, range(len(le_state.classes_)))),
   }, open("encoders.json", "w"))
   ```
3. **`item_catalog.csv`** — same file used by the app (copied here so the
   service can look up `shelf_life_days` by `item_id`).

## Local run

```bash
pip install -r requirements.txt
API_KEY=devkey uvicorn main:app --reload
```

Test:
```bash
curl -X POST http://localhost:8000/predict \
  -H 'Content-Type: application/json' -H 'X-API-Key: devkey' \
  -d '{"rows":[{"store_id":"s1","item_id":"fuji_apple","category":"fresh_fruits","state":"CA","snapshot_date":"2026-06-20","expiry_date":"2026-06-27","qty_on_hand":42}]}'
```

## Deploy to Render (free tier)

1. Push this repo to GitHub.
2. In Render -> **New** -> **Blueprint** and point it at this repo.
   `render.yaml` configures the service automatically.
3. Set `API_KEY` env var (any long random string).
4. Deploy. Copy the public URL (e.g. `https://durare-model.onrender.com`).
5. Send the URL + API key back to the Lovable agent — it will store them
   as `MODEL_SERVICE_URL` and `MODEL_SERVICE_API_KEY` and wire the
   "Refresh predictions" button.

Free tier sleeps after ~15 min idle (first request takes ~30s to wake).

## Contract

`POST /predict` (header `X-API-Key`):
```json
{ "rows": [{
  "store_id": "...", "item_id": "fuji_apple", "category": "fresh_fruits",
  "state": "CA", "snapshot_date": "2026-06-20", "expiry_date": "2026-06-27",
  "qty_on_hand": 42, "is_promo": false,
  "sales_history": [{"date": "2026-06-19", "units": 10}]
}]}
```

Response:
```json
{ "predictions": [{
  "store_id": "...", "item_id": "fuji_apple", "category": "fresh_fruits",
  "state": "CA", "snapshot_date": "2026-06-20", "expiry_date": "2026-06-27",
  "qty_on_hand": 42,
  "sales_q10": 30.5, "sales_q50": 41.2, "sales_q90": 49.8,
  "attribution": {
    "recent_trend": "down ~8%", "promo_active": false,
    "window_days": "mix of weekday and weekend"
  }
}], "model_version": "v1" }
```

## Quantile-model options (set `MODEL_LAYOUT`)

- `multiquantile` (default) — one Booster trained with multi-quantile output
  emitting `[q10, q50, q90]` columns.
- `three` — three Booster files for q10, q50, q90 (`xgboost_model_q10.json`,
  `xgboost_model_q50.json`, `xgboost_model_q90.json`).

The model MUST emit three quantiles — there is no single-q50 fallback.