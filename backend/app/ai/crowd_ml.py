from __future__ import annotations
from pathlib import Path
from typing import Any

MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "crowd_model.joblib"

def feature_row(show: Any, capacity: int, occupied: int, now) -> dict:
    start = show.start_time
    movie = getattr(show, "movie", None)
    screen = getattr(show, "screen", None)
    theatre = getattr(screen, "theatre", None) if screen else None
    return {
        "capacity": int(max(1, capacity)),
        "current_fill_rate": float(max(0, min(occupied, capacity)) / max(1, capacity) * 100),
        "hours_to_start": float(max(0, (start - now).total_seconds() / 3600)),
        "weekday": int(start.weekday()),
        "start_hour": int(start.hour),
        "is_weekend": bool(start.weekday() >= 5),
        "show_format": str(getattr(show, "format", "2D") or "2D").upper(),
        "language": str(getattr(movie, "language", "English") or "English"),
        "city": str(getattr(theatre, "city", "Unknown") or "Unknown").title(),
    }

def predict_with_trained_model(show: Any, capacity: int, occupied: int, now) -> dict | None:
    if not MODEL_PATH.exists():
        return None
    try:
        import joblib
        bundle = joblib.load(MODEL_PATH)
        prediction = float(bundle["pipeline"].predict([feature_row(show, capacity, occupied, now)])[0])
        prediction = max(0.0, min(100.0, prediction))
        prediction = max(prediction, occupied / max(1, capacity) * 100.0)
        return {"expected_fill_rate": round(prediction, 1), "model_type": "trained_random_forest_v1",
                "model_samples": int(bundle.get("samples", 0)),
                "model_metrics": bundle.get("metrics", {}),
                "limitation": "Trained on CineBook historical occupancy observations. Accuracy depends on the volume and representativeness of recorded shows."}
    except Exception:
        # A missing/corrupt/incompatible artifact must never break show discovery or booking.
        return None
