"""FastAPI wrapper around the XGBoost surplus-forecast model.

Contract matches the Lovable app:
  POST /predict  { rows: [...8 fields..., sales_history?: [{date, units}]] }
  ->            { predictions: [...7 fields...] }
"""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from model_loader import load_artifacts

API_KEY = os.environ.get("API_KEY", "")
SAFETY_BUFFER_DAYS = int(os.environ.get("SAFETY_BUFFER_DAYS", "2"))

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
    is_promo: bool = False
    sales_history: list[SaleHistoryEntry] = Field(default_factory=list)


class PredictRequest(BaseModel):
    rows: list[PredictRow]


class PredictResult(BaseModel):
    predicted_sales_q50: float
    predicted_surplus_qty: float
    confidence_low: float
    confidence_high: float
    target_date: str
    days_to_expiry: int
    drivers: str


class PredictResponse(BaseModel):
    predictions: list[PredictResult]
    model_version: str


def _encode(label: str, value: str) -> int:
    enc = ARTIFACTS.encoders.get(label, {})
    # Unknown categories map to -1; XGBoost handles missing fine.
    return int(enc.get(value, -1))


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

    shelf_life = ARTIFACTS.shelf_life_days.get(row.item_id, 7)

    return {
        "dow": snap.weekday(),
        "is_weekend": int(snap.weekday() >= 5),
        "month": snap.month,
        "is_holiday": int(_is_holiday(snap, row.state)),
        "is_promo": int(row.is_promo),
        "shelf_life_days": shelf_life,
        "item_id_code": _encode("item_id", row.item_id),
        "category_code": _encode("category", row.category),
        "store_id_code": _encode("store_id", row.store_id),
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
    "lag_1", "lag_7", "roll_7", "roll_28", "roll_std_7",
]


def _predict_quantiles(features: list[dict[str, float]]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns (q10, q50, q90). Supports three model layouts via env MODEL_LAYOUT:
    - 'single_q50' (default): one xgboost model predicting q50; q10/q90 approximated
      with +/- RESIDUAL_STD multiplier.
    - 'three': three booster files (q10, q50, q90).
    - 'multiquantile': one booster emitting three columns per row in [q10, q50, q90] order.
    """
    import xgboost as xgb

    df = pd.DataFrame(features, columns=FEATURE_ORDER)
    dmat = xgb.DMatrix(df.values, feature_names=FEATURE_ORDER)
    layout = ARTIFACTS.layout

    if layout == "three":
        q10 = ARTIFACTS.models["q10"].predict(dmat)
        q50 = ARTIFACTS.models["q50"].predict(dmat)
        q90 = ARTIFACTS.models["q90"].predict(dmat)
    elif layout == "multiquantile":
        out = ARTIFACTS.models["main"].predict(dmat)  # shape (n, 3)
        q10, q50, q90 = out[:, 0], out[:, 1], out[:, 2]
    else:  # single_q50
        q50 = ARTIFACTS.models["main"].predict(dmat)
        spread = float(os.environ.get("RESIDUAL_STD", "0.35")) * np.maximum(q50, 1.0)
        q10 = np.maximum(q50 - spread, 0.0)
        q90 = q50 + spread

    return np.maximum(q10, 0.0), np.maximum(q50, 0.0), np.maximum(q90, 0.0)


def _drivers_sentence(row: PredictRow, days_to_expiry: int, surplus: float, is_weekend: int, is_holiday: int) -> str:
    parts: list[str] = []
    if days_to_expiry <= 2:
        parts.append("Very close to expiry")
    elif days_to_expiry <= 4:
        parts.append(f"{days_to_expiry} days to expiry")
    if is_weekend:
        parts.append("weekend demand boost")
    if is_holiday:
        parts.append("holiday in window")
    if surplus > 0:
        parts.append(f"~{surplus:.0f} units projected surplus")
    else:
        parts.append("stock likely to clear")
    parts.append(f"pickup recommended {max(days_to_expiry - SAFETY_BUFFER_DAYS, 0)} day(s) before expiry")
    return "; ".join(parts) + "."


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
        snap = datetime.fromisoformat(r.snapshot_date).date()
        expiry = datetime.fromisoformat(r.expiry_date).date()
        days_to_expiry = int((expiry - snap).days)
        surplus = float(r.qty_on_hand - mid)
        conf_low = float(r.qty_on_hand - hi)   # most-sales scenario
        conf_high = float(r.qty_on_hand - lo)  # fewest-sales scenario

        # Target date = expiry - buffer, nudged by confidence
        buffer = SAFETY_BUFFER_DAYS
        if conf_high <= 0:
            buffer = max(buffer - 1, 0)   # more risk -> pick up sooner
        elif conf_low > 0:
            buffer = buffer + 1           # comfortable -> can wait
        target = expiry - timedelta(days=buffer)

        out.append(PredictResult(
            predicted_sales_q50=round(float(mid), 2),
            predicted_surplus_qty=round(surplus, 2),
            confidence_low=round(conf_low, 2),
            confidence_high=round(conf_high, 2),
            target_date=target.isoformat(),
            days_to_expiry=days_to_expiry,
            drivers=_drivers_sentence(r, days_to_expiry, surplus, f["is_weekend"], f["is_holiday"]),
        ))

    return PredictResponse(predictions=out, model_version=ARTIFACTS.version)