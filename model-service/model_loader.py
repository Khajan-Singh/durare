"""Load XGBoost model(s), encoders, and the item catalog at startup."""
from __future__ import annotations

import csv
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import xgboost as xgb

HERE = Path(__file__).parent

MODEL_LAYOUT = os.environ.get("MODEL_LAYOUT", "single_q50")  # single_q50 | three | multiquantile
MODEL_VERSION = os.environ.get("MODEL_VERSION", "v1")


@dataclass
class Artifacts:
    models: dict[str, Any]
    encoders: dict[str, dict[str, int]]
    shelf_life_days: dict[str, int]
    layout: str = MODEL_LAYOUT
    version: str = MODEL_VERSION


def _load_one(path: Path) -> xgb.Booster:
    booster = xgb.Booster()
    booster.load_model(str(path))
    return booster


def load_artifacts() -> Artifacts:
    encoders_path = HERE / "encoders.json"
    if not encoders_path.exists():
        raise RuntimeError(
            "encoders.json not found in model-service/. Export it from your training "
            "notebook (see README) and commit it next to the model file."
        )
    encoders = json.loads(encoders_path.read_text())

    shelf_life: dict[str, int] = {}
    catalog_path = HERE / "item_catalog.csv"
    if catalog_path.exists():
        with catalog_path.open() as f:
            for row in csv.DictReader(f):
                shelf_life[row["item_id"]] = int(row["shelf_life_days"])

    if MODEL_LAYOUT == "three":
        models = {
            "q10": _load_one(HERE / "xgboost_model_q10.json"),
            "q50": _load_one(HERE / "xgboost_model_q50.json"),
            "q90": _load_one(HERE / "xgboost_model_q90.json"),
        }
    else:
        models = {"main": _load_one(HERE / "xgboost_model.json")}

    return Artifacts(models=models, encoders=encoders, shelf_life_days=shelf_life)