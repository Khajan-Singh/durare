"""FastAPI wrapper around the XGBoost surplus-forecast model.

Contract matches the Lovable app:
  POST /predict  { rows: [...8 fields..., sales_history?: [{date, units}]] }
  ->            { predictions: [...raw quantiles + attribution...] }

The service returns only RAW model output (sales_q10, sales_q50, sales_q90)
plus an attribution JSON. The Lovable app derives surplus, confidence band,
target_date, days_to_expiry, and drivers on read.
"""
from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from model_loader import load_artifacts

API_KEY = os.environ.get("API_KEY", "")

app = FastAPI(title="Durare Surplus Forecast")
ARTIFACTS = load_artifacts()


class SaleHistoryEntry(BaseModel):
    date: str
    units: float


class PredictRow(BaseModel):
    store_id: str
    item_id: str
    category: str
    state: str
    snapshot_date: str  # ISO yyyy-mm-dd
    expiry_date: str
    qty_on_hand: float
    model_version: str | None = None
    model_store_id: str | None = None
    model_item_id: str | None = None
    model_category: str | None = None
    shelf_life_days: float | None = None
    is_promo: bool = False
    sales_history: list[SaleHistoryEntry] = Field(default_factory=list)


class PredictRequest(BaseModel):
    rows: list[PredictRow]


class PredictResult(BaseModel):
    store_id: str
    item_id: str
    category: str
    state: str
    snapshot_date: str
    expiry_date: str
    qty_on_hand: float
    sales_q10: float
    sales_q50: float
    sales_q90: float
    attribution: dict[str, Any]


class PredictResponse(BaseModel):
    predictions: list[PredictResult]
    model_version: str


def _encode(label: str, value: str) -> int:
    enc = ARTIFACTS.encoders.get(label, {})
    # Unknown categories map to -1; XGBoost handles missing fine.
    return int(enc.get(value, -1))


def _model_value(row: PredictRow, field: str) -> str:
    if field == "store_id":
        return row.model_store_id or row.store_id
    if field == "item_id":
        return row.model_item_id or row.item_id
    if field == "category":
        return row.model_category or row.category
    raise ValueError(f"unknown model field: {field}")


def _build_features(row: PredictRow) -> dict[str, float]:
    snap = datetime.fromisoformat(row.snapshot_date).date()
    expiry = datetime.fromisoformat(row.expiry_date).date()
    days_until_expiry = max((expiry - snap).days, 0)

    # Sales-history -> lag/roll
    hist = sorted(row.sales_history, key=lambda h: h.date)
    units = pd.Series([h.units for h in hist])

    def lag(n: int) -> float:
        return float(units.iloc[-n]) if len(units) >= n else 0.0

    def roll(n: int) -> float:
        return float(units.tail(n).mean()) if len(units) > 0 else 0.0

    def roll_std(n: int) -> float:
        return float(units.tail(n).std(ddof=0)) if len(units) > 1 else 0.0

    model_item_id = _model_value(row, "item_id")
    shelf_life = row.shelf_life_days or ARTIFACTS.shelf_life_days.get(model_item_id, 7)

    return {
        "dow": snap.weekday(),
        "is_weekend": int(snap.weekday() >= 5),
        "month": snap.month,
        "is_holiday": int(_is_holiday(snap, row.state)),
        "is_promo": int(row.is_promo),
        "shelf_life_days": shelf_life,
        "item_id_code": _encode("item_id", model_item_id),
        "category_code": _encode("category", _model_value(row, "category")),
        "store_id_code": _encode("store_id", _model_value(row, "store_id")),
        "state_code": _encode("state", row.state),
        "days_until_expiry": days_until_expiry,
        "is_near_expiry": int(days_until_expiry <= 2),
        "lag_1": lag(1),
        "lag_7": lag(7),
        "roll_7": roll(7),
        "roll_28": roll(28),
        "roll_std_7": roll_std(7),
    }


def _is_holiday(d: date, state: str) -> bool:
    try:
        import holidays  # lazy import
        cal = holidays.country_holidays("US", subdiv=state) if state else holidays.country_holidays("US")
        return d in cal
    except Exception:
        return False


FEATURE_ORDER = [
    "dow", "is_weekend", "month", "is_holiday", "is_promo", "shelf_life_days",
    "item_id_code", "category_code", "store_id_code", "state_code",
    "days_until_expiry", "is_near_expiry",
]


def _predict_quantiles(features: list[dict[str, float]]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns (q10, q50, q90). Supports two model layouts via env MODEL_LAYOUT:
    - 'three': three booster files (q10, q50, q90).
    - 'multiquantile': one booster emitting three columns per row in [q10, q50, q90] order.
    The 'single_q50' fallback was removed — the model MUST emit three quantiles.
    """
    import xgboost as xgb

    df = pd.DataFrame(features, columns=FEATURE_ORDER)
    dmat = xgb.DMatrix(df.values, feature_names=FEATURE_ORDER)
    layout = ARTIFACTS.layout

    if layout == "three":
        q10 = ARTIFACTS.models["q10"].predict(dmat)
        q50 = ARTIFACTS.models["q50"].predict(dmat)
        q90 = ARTIFACTS.models["q90"].predict(dmat)
    else:  # multiquantile (default)
        out = ARTIFACTS.models["main"].predict(dmat)  # shape (n, 3)
        q10, q50, q90 = out[:, 0], out[:, 1], out[:, 2]

    # Clamp negatives and enforce monotonic quantiles q10 <= q50 <= q90.
    # Quantile boosters can cross; row-wise sorting preserves the interval
    # instead of collapsing q90 to q50 whenever the high column is below mid.
    ordered = np.sort(np.maximum(np.column_stack([q10, q50, q90]), 0.0), axis=1)
    return ordered[:, 0], ordered[:, 1], ordered[:, 2]


def _attribution(row: PredictRow, features: dict[str, float]) -> dict[str, Any]:
    """Build the model's stated reasons. Kept narrow and factual; the Lovable
    app turns these into prose. Never invent fields the model can't justify."""
    hist = sorted(row.sales_history, key=lambda h: h.date)
    trend: str | None = None
    if len(hist) >= 14:
        recent = float(np.mean([h.units for h in hist[-7:]]))
        prior = float(np.mean([h.units for h in hist[-14:-7]]))
        if prior > 0:
            change = (recent - prior) / prior
            if abs(change) >= 0.05:
                direction = "up" if change > 0 else "down"
                trend = f"{direction} ~{abs(change) * 100:.0f}%"
            else:
                trend = "flat"
    snap = datetime.fromisoformat(row.snapshot_date).date()
    expiry = datetime.fromisoformat(row.expiry_date).date()
    window_days = (expiry - snap).days
    weekend_count = sum(
        1 for i in range(window_days + 1)
        if (snap.toordinal() + i) % 7 in (5, 6)
    )
    if window_days <= 0:
        window_desc = "same day"
    elif weekend_count == 0:
        window_desc = "mid-week only"
    elif weekend_count >= window_days:
        window_desc = "weekend only"
    else:
        window_desc = "mix of weekday and weekend"

    attr: dict[str, Any] = {
        "promo_active": bool(row.is_promo),
        "window_days": window_desc,
    }
    if trend is not None:
        attr["recent_trend"] = trend
    return attr


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "model_version": ARTIFACTS.version, "layout": ARTIFACTS.layout}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest, x_api_key: str = Header(default="")) -> PredictResponse:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")
    if not req.rows:
        return PredictResponse(predictions=[], model_version=ARTIFACTS.version)

    features = [_build_features(r) for r in req.rows]
    q10, q50, q90 = _predict_quantiles(features)

    out: list[PredictResult] = []
    for r, f, lo, mid, hi in zip(req.rows, features, q10, q50, q90):
        out.append(PredictResult(
            store_id=r.store_id,
            item_id=r.item_id,
            category=r.category,
            state=r.state,
            snapshot_date=r.snapshot_date,
            expiry_date=r.expiry_date,
            qty_on_hand=float(r.qty_on_hand),
            sales_q10=round(float(lo), 2),
            sales_q50=round(float(mid), 2),
            sales_q90=round(float(hi), 2),
            attribution=_attribution(r, f),
        ))

    return PredictResponse(predictions=out, model_version=ARTIFACTS.version)