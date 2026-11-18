from datetime import timedelta
from ..config import now_local
from .crowd_ml import predict_with_trained_model


def predict_crowd(show, capacity: int, occupied: int) -> dict:
    """Transparent rules baseline. Do not describe this as trained ML."""
    capacity = max(1, capacity)
    occupied = max(0, min(occupied, capacity))
    current = occupied / capacity
    signals = [f"Current seat occupancy: {occupied}/{capacity} ({current * 100:.1f}%)"]
    start = show.start_time
    weekend = start.weekday() >= 5
    evening = start.hour >= 17 and start.hour <= 22
    premium_format = (getattr(show, "format", "2D") or "2D").upper() in {"IMAX 2D", "4DX", "DOLBY ATMOS", "P[XL]", "3D"}
    demand = 0.40
    if weekend:
        demand += 0.20
        signals.append("Weekend showtime can attract higher demand")
    if evening:
        demand += 0.15
        signals.append("Evening showtime can attract higher demand")
    if premium_format:
        demand += 0.10
        signals.append(f"Premium/immersive format signal: {getattr(show, 'format', '2D')}")
    hours_to_show = max(0.0, (start - now_local()).total_seconds() / 3600)
    lead_factor = min(1.0, hours_to_show / 48.0)
    remaining = 1.0 - current
    expected = current + remaining * demand * (0.25 + 0.75 * lead_factor)
    expected = max(current, min(0.98, expected))
    if expected >= 0.85:
        level = "Very High"
    elif expected >= 0.65:
        level = "High"
    elif expected >= 0.35:
        level = "Moderate"
    else:
        level = "Low"
    signals.append(f"Demand uplift uses a {demand:.2f} rule score and {hours_to_show:.1f} hours to showtime")
    trained = predict_with_trained_model(show, capacity, occupied, now_local())
    model_type = "deterministic_baseline_v1"
    limitation = "Baseline estimate; not a trained model. Collect occupancy snapshots and train the model before reporting ML accuracy."
    if trained:
        expected = max(current * 100, trained["expected_fill_rate"]) / 100.0
        model_type = trained["model_type"]
        limitation = trained["limitation"]
        signals.append(f"Trained Random Forest forecast based on {trained['model_samples']} historical observations")
    if expected >= 0.85:
        level = "Very High"
    elif expected >= 0.65:
        level = "High"
    elif expected >= 0.35:
        level = "Moderate"
    else:
        level = "Low"
    result = {"capacity": capacity, "occupied_seats": occupied,
              "current_fill_rate": round(current * 100, 1),
              "expected_fill_rate": round(expected * 100, 1),
              "rush_level": level, "signals": signals,
              "model_type": model_type, "limitation": limitation}
    if trained:
        result["model_samples"] = trained["model_samples"]
        result["model_metrics"] = trained["model_metrics"]
    return result
